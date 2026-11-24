import { TRPCError } from "@trpc/server";
import { checkBotId } from "botid/server";
import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { renderContactSubmissionEmail } from "~/emails/staff";
import { sendEmail } from "~/server/email/send";

export const contactRouter = createTRPCRouter({
  getAll: adminProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const search = input?.search?.toLowerCase().trim();

      const where = search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
              { subject: { contains: search, mode: "insensitive" as const } },
              { message: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : undefined;

      return ctx.db.contactSubmission.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });
    }),

  getById: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.contactSubmission.findUnique({
        where: { id: input.id },
      });
    }),

  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.email(),
        reason: z.string().min(1).max(32),
        message: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Spam bots were filling the form. `src/instrumentation-client.ts`
      // attaches the BotID token this verifies.
      const { isBot } = await checkBotId();
      if (isBot) throw new TRPCError({ code: "FORBIDDEN" });

      const submission = await ctx.db.contactSubmission.create({
        data: {
          name: input.name,
          email: input.email,
          subject: input.reason,
          message: input.message,
        },
      });

      // Send email notification
      try {
        const notificationEmailSetting = await ctx.db.keyValueStore.findUnique({
          where: { key: "contactFormNotification" },
        });

        if (notificationEmailSetting?.value) {
          const result = await sendEmail({
            from: "notifications",
            to: notificationEmailSetting.value,
            ...renderContactSubmissionEmail({
              name: input.name,
              email: input.email,
              reason: input.reason,
              message: input.message,
              adminUrl: `${process.env.NEXT_PUBLIC_APP_URL}/admin/contact`,
            }),
          });
          if (!result.ok) {
            console.error(
              "Failed to send contact notification email:",
              result.error,
            );
          }
        }
      } catch (error) {
        console.error("Failed to send contact notification email:", error);
      }

      return submission;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.contactSubmission.delete({
        where: { id: input.id },
      });
    }),
});
