import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { sendEmail } from "~/server/utils/email";

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
          await sendEmail({
            to: notificationEmailSetting.value,
            subject: `New Contact Submission: ${input.reason}`,
            text: `A new contact form submission has been received.\n\n` +
              `From: ${input.name} <${input.email}>\n` +
              `Reason: ${input.reason}\n\n` +
              `Message:\n${input.message}`,
            html: `
              <h1>New Contact Submission</h1>
              <p><strong>From:</strong> ${input.name} &lt;${input.email}&gt;</p>
              <p><strong>Reason:</strong> ${input.reason}</p>
              <p><strong>Message:</strong></p>
              <div style="white-space: pre-wrap; background: #f4f4f4; padding: 1rem; border-radius: 4px;">
                ${input.message}
              </div>
              <br/>
              <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/admin/contact">View all submissions in Admin Dashboard</a></p>
            `,
          });
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
