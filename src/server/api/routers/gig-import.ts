import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { env } from "~/env";
import {
  gigExtractionSchema,
  type GigExtraction,
} from "~/lib/gig-import/extraction";
import { plainTextToLexical } from "~/lib/gig-import/lexical";
import {
  extractionModel,
  ExtractionUnavailableError,
  extractGigFromPost,
} from "~/server/gig-import/extract";
import {
  fetchImageBytes,
  fetchInstagramPost,
  InstagramUnavailableError,
  manualPost,
  type InstagramPost,
} from "~/server/gig-import/instagram";
import { resolveExtraction } from "~/server/gig-import/draft";
import { uploadFromBuffer } from "~/server/uploads/service";
import { logUserActivity } from "~/server/utils/activity-log";
import {
  ActivityType,
  GigImportSource,
  GigMode,
  GigScheduleKind,
  GigStatus,
  Prisma,
  type PrismaClient,
} from "~Prisma/client";

/**
 * The import wizard's server half.
 *
 * The wizard writes gigs through the gig editor's own `gigs.saveAll`, so there
 * is one place that knows how to save a gig. What lives here is only the part
 * import adds: reading a post, keeping a record of what was read, deriving the
 * bill from it, and the draft-to-live transition.
 */

/** Poster images are fetched from Instagram's CDN, which is not instant. */
const POSTER_FETCH_TIMEOUT_MS = 20_000;

/**
 * The stored JSON, read back. Anything that fails the schema is a row written
 * by an older shape of this feature, and is treated as unreadable rather than
 * trusted.
 */
const parseExtraction = (value: Prisma.JsonValue): GigExtraction | null => {
  const parsed = gigExtractionSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

const RAW_POST_SHAPE = z.object({
  shortcode: z.string(),
  permalink: z.string(),
  username: z.string().nullable(),
  caption: z.string(),
  postedAt: z.string(),
  images: z.array(z.object({ url: z.string(), index: z.number() })),
});

const parsePost = (value: Prisma.JsonValue): InstagramPost | null => {
  const parsed = RAW_POST_SHAPE.safeParse(value);
  return parsed.success ? parsed.data : null;
};

const asJson = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

/**
 * Rebuild the draft's sets from the extraction and whatever profiles exist now.
 *
 * Called after an admin creates a profile for a handle the post named but the
 * site did not have. Rebuilding rather than patching keeps one definition of
 * what the bill is: the post said it, and these are the profiles behind it.
 *
 * Deliberately limited to sets on a draft. A published gig's run sheet has been
 * worked on by somebody, and this would throw that away.
 */
async function syncLineUpFromExtraction(
  db: PrismaClient,
  gigId: string,
  extraction: GigExtraction,
) {
  const gig = await db.gig.findUnique({
    where: { id: gigId },
    select: { id: true, status: true },
  });
  if (gig?.status !== GigStatus.DRAFT) return;

  const resolved = await resolveExtraction(db, extraction, new Date());
  const slots = resolved.slots.filter(
    (slot) => slot.creatorProfileIds.length > 0,
  );

  await db.$transaction(async (tx) => {
    await tx.gigScheduleItem.deleteMany({
      where: { gigId, kind: GigScheduleKind.SET },
    });

    for (const [index, slot] of slots.entries()) {
      const item = await tx.gigScheduleItem.create({
        data: {
          gigId,
          kind: GigScheduleKind.SET,
          role: slot.role,
          // Billing comes from the profiles; a label would only repeat them.
          label: null,
          sortOrder: index,
          leadMinutes: [5],
        },
        select: { id: true },
      });
      await tx.gigSetArtist.createMany({
        data: slot.creatorProfileIds.map((creatorProfileId, billing) => ({
          itemId: item.id,
          creatorProfileId,
          sortOrder: billing,
        })),
        skipDuplicates: true,
      });
    }
  });
}

/** Fetch the post's first image and make it the draft's poster. */
async function attachPoster(
  ctx: { db: PrismaClient; session: { user: { id: string } } },
  gigId: string,
  post: InstagramPost,
): Promise<boolean> {
  const first = post.images[0];
  if (!first) return false;

  try {
    const image = await fetchImageBytes(first.url, POSTER_FETCH_TIMEOUT_MS);

    const extension = image.contentType.split("/")[1]?.split(";")[0] ?? "jpg";
    const uploaded = await uploadFromBuffer(
      {
        preset: "gigPoster",
        context: { gigId },
        file: {
          name: `instagram-${post.shortcode || "post"}.${extension}`,
          type: image.contentType,
          body: image.buffer,
        },
      },
      ctx,
    );

    await ctx.db.gig.update({
      where: { id: gigId },
      data: { posterFileUploadId: uploaded.id },
    });
    return true;
  } catch {
    // A missing poster is a checklist warning, not a failed import. The admin
    // can upload one, and the caption is usually the more valuable half.
    return false;
  }
}

export const gigImportRouter = createTRPCRouter({
  /**
   * What the wizard can actually do right now, so step one can say so up front
   * instead of failing after the admin has pasted a link.
   */
  availability: adminProcedure.query(() => ({
    canExtract: Boolean(env.OPENROUTER_API_KEY),
    canReadInstagram: Boolean(
      env.OPENROUTER_API_KEY && env.INSTAGRAM_ACCESS_TOKEN,
    ),
    /** Shown on step one, so a bad slug is diagnosable without a deploy. */
    model: env.OPENROUTER_MODEL,
  })),

  /** The last few runs, and what became of each. */
  recent: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(20).default(5) }).optional())
    .query(async ({ ctx, input }) => {
      const imports = await ctx.db.gigImport.findMany({
        orderBy: { createdAt: "desc" },
        take: input?.limit ?? 5,
        select: {
          id: true,
          source: true,
          sourceUrl: true,
          createdAt: true,
          gig: {
            select: { id: true, title: true, status: true },
          },
        },
      });
      return imports;
    }),

  /**
   * Read a post and make a draft of it.
   *
   * Everything happens in one call because a half-run import is worse than none:
   * the admin would be left with a record of a post and no gig, or a gig with
   * nothing in it. What can fail without failing the import is the poster.
   */
  read: adminProcedure
    .input(
      z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("instagram"), url: z.string().min(1) }),
        z.object({
          kind: z.literal("caption"),
          caption: z.string().min(1).max(20_000),
        }),
      ]),
    )
    .mutation(async ({ ctx, input }) => {
      if (!env.OPENROUTER_API_KEY) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Gig import is not configured on this environment.",
        });
      }

      let post: InstagramPost;
      try {
        post =
          input.kind === "instagram"
            ? await fetchInstagramPost(input.url)
            : manualPost(input.caption);
      } catch (error) {
        if (error instanceof InstagramUnavailableError) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
            cause: error,
          });
        }
        throw error;
      }

      // Images are downloaded once and used twice: shown to the model, because
      // posters carry details the caption leaves out, and kept for the poster.
      const images = await Promise.all(
        post.images
          .slice(0, 2)
          .map((image) => fetchImageBytes(image.url).catch(() => null)),
      );

      const tags = await ctx.db.gigTag.findMany({ select: { name: true } });

      let extraction: GigExtraction;
      try {
        extraction = await extractGigFromPost({
          post,
          existingTagNames: tags.map((tag) => tag.name),
          images: images.filter((image) => image !== null),
        });
      } catch (error) {
        if (error instanceof ExtractionUnavailableError) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
            cause: error,
          });
        }
        throw error;
      }

      const resolved = await resolveExtraction(
        ctx.db,
        extraction,
        new Date(post.postedAt),
      );

      // No date found is exactly what to-be-announced already means here, and
      // it is why `gigStartTime` can stay non-null without anybody inventing a
      // date: the site knows to hide a TBA gig's stand-in.
      const mode =
        resolved.dateUnknown || extraction.mode.value === "TO_BE_ANNOUNCED"
          ? GigMode.TO_BE_ANNOUNCED
          : GigMode.NORMAL;

      const description = plainTextToLexical(resolved.descriptionText);

      const gig = await ctx.db.gig.create({
        data: {
          status: GigStatus.DRAFT,
          title: resolved.title,
          subtitle: resolved.subtitle,
          shortDescription: resolved.shortDescription || null,
          descriptionLexical: description
            ? (description as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          mode,
          ticketLink: resolved.ticketLink,
          gigStartTime: resolved.startsAt,
          gigEndTime: resolved.endsAt,
          gigTags: {
            create: resolved.tagIds.map((gigTagId) => ({ gigTagId })),
          },
        },
        select: { id: true, title: true },
      });

      await syncLineUpFromExtraction(ctx.db, gig.id, extraction);

      // Recorded before the poster is fetched: that step reaches out to a CDN
      // and is allowed to fail, and a draft with no record of what produced it
      // is far worse than a draft with no poster.
      const record = await ctx.db.gigImport.create({
        data: {
          source:
            input.kind === "instagram"
              ? GigImportSource.INSTAGRAM
              : GigImportSource.MANUAL,
          sourceUrl: input.kind === "instagram" ? input.url : null,
          raw: asJson(post),
          extraction: asJson(extraction),
          model: extractionModel(),
          gigId: gig.id,
          createdById: ctx.session.user.id,
        },
        select: { id: true },
      });

      const posterAttached = await attachPoster(ctx, gig.id, post);

      await logUserActivity(
        ActivityType.GIG_IMPORTED,
        `Imported "${gig.title}" from ${
          input.kind === "instagram" ? "Instagram" : "a pasted caption"
        }`,
        ctx.session.user.id,
        undefined,
        { gigId: gig.id },
      );

      return {
        importId: record.id,
        gigId: gig.id,
        posterAttached,
      };
    }),

  /**
   * Everything the review screens need: the post, the reading of it, and what
   * could not be placed. The draft itself comes from `gigs.getForEditor`, so
   * the wizard edits a gig with the same data the gig editor does.
   */
  get: adminProcedure
    .input(z.object({ importId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const record = await ctx.db.gigImport.findUnique({
        where: { id: input.importId },
        select: {
          id: true,
          source: true,
          sourceUrl: true,
          model: true,
          createdAt: true,
          raw: true,
          extraction: true,
          gig: {
            select: {
              id: true,
              title: true,
              status: true,
              posterFileUploadId: true,
            },
          },
        },
      });
      if (!record) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Import not found" });
      }

      const extraction = parseExtraction(record.extraction);
      const post = parsePost(record.raw);
      if (!extraction || !post) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This import was recorded in a shape this page cannot read.",
        });
      }

      const resolved = await resolveExtraction(
        ctx.db,
        extraction,
        new Date(post.postedAt),
      );

      return {
        id: record.id,
        source: record.source,
        sourceUrl: record.sourceUrl,
        model: record.model,
        createdAt: record.createdAt,
        post,
        extraction,
        gig: record.gig,
        unmatchedHandles: resolved.unmatchedHandles,
        unmatchedTagNames: resolved.unmatchedTagNames,
        /** Slots the post named that put nobody on the bill. */
        unplacedSlots: resolved.slots.filter(
          (slot) => slot.creatorProfileIds.length === 0,
        ),
      };
    }),

  /**
   * Re-derive the draft's sets after a profile has been created for a handle
   * the post named. See `syncLineUpFromExtraction`.
   */
  syncLineUp: adminProcedure
    .input(z.object({ importId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const record = await ctx.db.gigImport.findUnique({
        where: { id: input.importId },
        select: { gigId: true, extraction: true },
      });
      const extraction = record ? parseExtraction(record.extraction) : null;
      if (!record?.gigId || !extraction) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That import no longer has a draft to update.",
        });
      }
      await syncLineUpFromExtraction(ctx.db, record.gigId, extraction);
      return { ok: true as const };
    }),

  /** Put a draft on the site. The one action that makes a gig public. */
  publish: adminProcedure
    .input(z.object({ gigId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const gig = await ctx.db.gig.findUnique({
        where: { id: input.gigId },
        select: { id: true, title: true, status: true, publishedAt: true },
      });
      if (!gig) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Gig not found" });
      }
      if (gig.status === GigStatus.PUBLISHED) return { ok: true as const };

      await ctx.db.gig.update({
        where: { id: gig.id },
        data: {
          status: GigStatus.PUBLISHED,
          // Kept from the first time it went live, so unpublishing and
          // republishing does not rewrite the gig's history.
          publishedAt: gig.publishedAt ?? new Date(),
        },
      });

      await logUserActivity(
        ActivityType.GIG_PUBLISHED,
        `Published gig "${gig.title}"`,
        ctx.session.user.id,
        undefined,
        { gigId: gig.id },
      );
      return { ok: true as const };
    }),

  /** Take a published gig back off the site without deleting it. */
  unpublish: adminProcedure
    .input(z.object({ gigId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const gig = await ctx.db.gig.findUnique({
        where: { id: input.gigId },
        select: { id: true, title: true, status: true },
      });
      if (!gig) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Gig not found" });
      }
      if (gig.status === GigStatus.DRAFT) return { ok: true as const };

      await ctx.db.gig.update({
        where: { id: gig.id },
        data: { status: GigStatus.DRAFT },
      });

      await logUserActivity(
        ActivityType.GIG_UNPUBLISHED,
        `Took gig "${gig.title}" off the site`,
        ctx.session.user.id,
        undefined,
        { gigId: gig.id },
      );
      return { ok: true as const };
    }),

  /**
   * Throw the draft away. The import record survives on purpose: a discarded
   * import is the only evidence of an extraction that was not good enough, and
   * it is worth keeping when the next one is being looked at.
   */
  discard: adminProcedure
    .input(z.object({ importId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const record = await ctx.db.gigImport.findUnique({
        where: { id: input.importId },
        select: { gigId: true, gig: { select: { status: true, title: true } } },
      });
      if (!record?.gigId || !record.gig) return { ok: true as const };

      if (record.gig.status !== GigStatus.DRAFT) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "That gig is live. Take it off the site before discarding it.",
        });
      }

      // `gig_import.gigId` is ON DELETE SET NULL, so the record of what was
      // read outlives the draft it produced.
      await ctx.db.gig.delete({ where: { id: record.gigId } });

      await logUserActivity(
        ActivityType.GIG_DELETED,
        `Discarded imported draft "${record.gig.title}"`,
        ctx.session.user.id,
      );
      return { ok: true as const };
    }),
});
