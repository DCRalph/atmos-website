import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { after } from "next/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  markRoomRead,
  notifyRoom,
  roomMemberIds,
  unreadCounts,
  visibleGigFilter,
} from "~/server/gig-chat";
import {
  isReaction,
  MAX_MESSAGE_LENGTH,
  ROOM_WINDOW_DAYS,
} from "~/lib/gig-chat/room";

/**
 * A gig's chat room.
 *
 * Every procedure resolves membership through `requireMember` rather than a
 * permission middleware, because the rule is per gig: an admin is in every
 * room, and everybody else is in the rooms they are on the notify list for.
 * There is no read-only variant — if you can see a room you can talk in it,
 * which is the only sensible arrangement for six people running a night.
 *
 * Live-ness is polling. `room` is refetched every few seconds while it is open
 * and not at all when it is not, and it is a handful of indexed queries for one
 * gig. The upgrade path if that ever stops being true is a `since` cursor on
 * that procedure, and after that sockets; neither changes a component.
 */

/**
 * The newest N. Deliberately not paginated: this is a room for one night, and
 * "load earlier" is a feature for a room with history worth scrolling.
 */
const PAGE = 50;

const gigInput = z.object({ gigId: z.string().min(1) });

/**
 * Membership, or a refusal. Every procedure below starts with this.
 *
 * Returns whether they got in by being an admin, because the two facts come
 * from the same lookup and the room needs both: one to let them in, the other
 * to decide whose messages they may delete. Asking twice would double the
 * queries on a path that runs every few seconds per open room.
 */
async function requireMember(
  gigId: string,
  userId: string,
): Promise<{ isAdmin: boolean }> {
  const visible = await visibleGigFilter(userId);
  if (visible.kind === "all") return { isAdmin: true };
  if (visible.gigIds.includes(gigId)) return { isAdmin: false };

  throw new TRPCError({
    code: "FORBIDDEN",
    message: "This room is for the people working the gig.",
  });
}

export const gigChatRouter = createTRPCRouter({
  /**
   * Every room this person is in, oldest gig first.
   *
   * Windowed rather than archived: a gig drops off the list a week after it
   * happened, so nobody has to close a room and no room is closed while the
   * load-out is still going.
   */
  rooms: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const visible = await visibleGigFilter(userId);

    const gigs = await ctx.db.gig.findMany({
      where: {
        gigStartTime: {
          gte: new Date(Date.now() - ROOM_WINDOW_DAYS * 24 * 60 * 60 * 1000),
        },
        ...(visible.kind === "some" ? { id: { in: visible.gigIds } } : {}),
      },
      orderBy: { gigStartTime: "asc" },
      select: {
        id: true,
        title: true,
        subtitle: true,
        gigStartTime: true,
      },
    });
    if (gigs.length === 0) return [];

    const gigIds = gigs.map((gig) => gig.id);

    // The newest message per gig, in two queries rather than one per room:
    // group for the timestamps, then fetch exactly those rows.
    const newest = await ctx.db.gigChatMessage.groupBy({
      by: ["gigId"],
      where: { gigId: { in: gigIds }, deletedAt: null },
      _max: { createdAt: true },
    });

    const [previews, unread, muted] = await Promise.all([
      newest.length === 0
        ? []
        : ctx.db.gigChatMessage.findMany({
            where: {
              OR: newest.flatMap((row) =>
                row._max.createdAt
                  ? [{ gigId: row.gigId, createdAt: row._max.createdAt }]
                  : [],
              ),
            },
            select: {
              gigId: true,
              body: true,
              createdAt: true,
              author: { select: { name: true } },
            },
          }),
      unreadCounts(userId, gigIds),
      ctx.db.gigChatRead.findMany({
        where: { userId, gigId: { in: gigIds }, muted: true },
        select: { gigId: true },
      }),
    ]);

    const previewFor = new Map(previews.map((row) => [row.gigId, row]));
    const mutedGigs = new Set(muted.map((row) => row.gigId));

    return gigs.map((gig) => {
      const preview = previewFor.get(gig.id);
      return {
        ...gig,
        unread: unread.get(gig.id) ?? 0,
        muted: mutedGigs.has(gig.id),
        lastMessage: preview
          ? {
              author: preview.author.name,
              body: preview.body,
              createdAt: preview.createdAt,
            }
          : null,
      };
    });
  }),

  /** One number, for the way in on the More tab. */
  unreadTotal: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const visible = await visibleGigFilter(userId);

    const gigs = await ctx.db.gig.findMany({
      where: {
        gigStartTime: {
          gte: new Date(Date.now() - ROOM_WINDOW_DAYS * 24 * 60 * 60 * 1000),
        },
        ...(visible.kind === "some" ? { id: { in: visible.gigIds } } : {}),
      },
      select: { id: true },
    });

    const counts = await unreadCounts(
      userId,
      gigs.map((gig) => gig.id),
    );
    return [...counts.values()].reduce((total, count) => total + count, 0);
  }),

  /**
   * A room: the gig, who is in it and how far each has read, and the transcript.
   *
   * Reading the room marks it read, which is both what a person means by
   * opening it and how presence works — see `notifyRoom`. The members' marks
   * are read before the viewer's is bumped, so nobody's receipts are affected
   * by the act of looking at them.
   */
  room: protectedProcedure
    .input(gigInput.extend({ markRead: z.boolean().default(true) }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { isAdmin } = await requireMember(input.gigId, userId);

      const gig = await ctx.db.gig.findUnique({
        where: { id: input.gigId },
        select: {
          id: true,
          title: true,
          subtitle: true,
          gigStartTime: true,
        },
      });
      if (!gig) throw new TRPCError({ code: "NOT_FOUND" });

      const memberIds = await roomMemberIds(input.gigId);

      const [people, marks, messages, mine] = await Promise.all([
        ctx.db.user.findMany({
          where: { id: { in: memberIds } },
          orderBy: { name: "asc" },
          select: { id: true, name: true, image: true },
        }),
        ctx.db.gigChatRead.findMany({
          where: { gigId: input.gigId, userId: { in: memberIds } },
          select: { userId: true, lastReadAt: true },
        }),
        ctx.db.gigChatMessage.findMany({
          where: { gigId: input.gigId },
          orderBy: { createdAt: "desc" },
          take: PAGE,
          select: {
            id: true,
            body: true,
            createdAt: true,
            deletedAt: true,
            authorId: true,
            author: { select: { id: true, name: true, image: true } },
            reactions: {
              orderBy: { createdAt: "asc" },
              select: {
                emoji: true,
                userId: true,
                user: { select: { name: true } },
              },
            },
          },
        }),
        ctx.db.gigChatRead.findUnique({
          where: { gigId_userId: { gigId: input.gigId, userId } },
          select: { muted: true },
        }),
      ]);

      if (input.markRead) await markRoomRead(input.gigId, userId);

      const markFor = new Map(
        marks.map((mark) => [mark.userId, mark.lastReadAt]),
      );

      return {
        gig,
        /// Who is asking, so a client never has to work out "is this mine" from
        /// a second source that could disagree with the one that authorised it.
        viewerId: userId,
        muted: mine?.muted ?? false,
        members: people.map((person) => ({
          id: person.id,
          name: person.name,
          image: person.image,
          lastReadAt: markFor.get(person.id) ?? null,
        })),
        // Newest last, which is the order it is drawn in. Fetched the other way
        // round so `take` gets the newest rather than the first fifty of a
        // night that has been going for hours.
        messages: messages.reverse().map((message) => ({
          id: message.id,
          authorId: message.authorId,
          author: message.author,
          // A deleted message keeps its place and loses its contents.
          body: message.deletedAt ? "" : message.body,
          deleted: message.deletedAt !== null,
          createdAt: message.createdAt,
          // Said out loud rather than left for a client to infer, so the button
          // is only ever drawn where `remove` would actually succeed.
          canDelete: message.authorId === userId || isAdmin,
          reactions: message.deletedAt
            ? []
            : message.reactions.map((reaction) => ({
                emoji: reaction.emoji,
                userId: reaction.userId,
                userName: reaction.user.name,
              })),
        })),
      };
    }),

  send: protectedProcedure
    .input(
      gigInput.extend({
        body: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await requireMember(input.gigId, userId);

      const gig = await ctx.db.gig.findUnique({
        where: { id: input.gigId },
        select: { id: true, title: true },
      });
      if (!gig) throw new TRPCError({ code: "NOT_FOUND" });

      const message = await ctx.db.gigChatMessage.create({
        data: { gigId: input.gigId, authorId: userId, body: input.body },
        select: { id: true, createdAt: true },
      });

      // Saying something is reading the room.
      await markRoomRead(input.gigId, userId);

      // After the response, not before it. The message is committed either way,
      // and a send that waits on Expo is a send that feels slow for no reason.
      after(async () => {
        await notifyRoom({
          gigId: input.gigId,
          gigTitle: gig.title,
          authorId: userId,
          authorName: ctx.session.user.name,
          body: input.body,
        });
      });

      return message;
    }),

  /**
   * Add or remove one reaction. Tapping a chip you are already in removes you,
   * which is what makes the chip a toggle rather than a counter that only goes
   * up.
   */
  react: protectedProcedure
    .input(
      z.object({
        messageId: z.string().min(1),
        emoji: z.string().refine(isReaction, "not one of the five"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const message = await ctx.db.gigChatMessage.findUnique({
        where: { id: input.messageId },
        select: { gigId: true, deletedAt: true },
      });
      if (!message || message.deletedAt)
        throw new TRPCError({ code: "NOT_FOUND" });
      await requireMember(message.gigId, userId);

      const existing = await ctx.db.gigChatReaction.findUnique({
        where: {
          messageId_userId_emoji: {
            messageId: input.messageId,
            userId,
            emoji: input.emoji,
          },
        },
        select: { id: true },
      });

      if (existing) {
        await ctx.db.gigChatReaction.delete({ where: { id: existing.id } });
        return { reacted: false as const };
      }

      await ctx.db.gigChatReaction.create({
        data: { messageId: input.messageId, userId, emoji: input.emoji },
      });
      return { reacted: true as const };
    }),

  /**
   * Take a message back.
   *
   * Yours always, anybody's if you are an admin — a room running a door needs
   * somebody able to pull a wrong phone number off the screen without waiting
   * for the person who typed it. The body is cleared rather than the row
   * deleted, so the transcript keeps its shape.
   */
  remove: protectedProcedure
    .input(z.object({ messageId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const message = await ctx.db.gigChatMessage.findUnique({
        where: { id: input.messageId },
        select: { id: true, gigId: true, authorId: true, deletedAt: true },
      });
      if (!message) throw new TRPCError({ code: "NOT_FOUND" });
      const { isAdmin } = await requireMember(message.gigId, userId);
      if (message.deletedAt) return { ok: true as const };

      if (message.authorId !== userId && !isAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the author or an admin can delete a message.",
        });
      }

      await ctx.db.gigChatMessage.update({
        where: { id: message.id },
        data: { deletedAt: new Date(), body: "" },
      });
      return { ok: true as const };
    }),

  /** Read up to now. Idempotent, and never moves backwards. */
  markRead: protectedProcedure
    .input(gigInput)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await requireMember(input.gigId, userId);
      await markRoomRead(input.gigId, userId);
      return { ok: true as const };
    }),

  setMuted: protectedProcedure
    .input(gigInput.extend({ muted: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await requireMember(input.gigId, userId);

      await ctx.db.gigChatRead.upsert({
        where: { gigId_userId: { gigId: input.gigId, userId } },
        create: { gigId: input.gigId, userId, muted: input.muted },
        update: { muted: input.muted },
      });
      return { muted: input.muted };
    }),
});
