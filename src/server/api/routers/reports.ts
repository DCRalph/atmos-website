import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { env } from "~/env";
import { createReportSchema } from "~/lib/reports";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { reportDocument } from "~/server/reports/document";
import { decryptReport, encryptReport } from "~/server/reports/encryption";
import { deleteObject, getObjectBuffer, putBuffer } from "~/server/uploads/r2";

const reportSelect = {
  id: true,
  title: true,
  createdAt: true,
  conversationId: true,
  user: { select: { id: true, name: true, image: true } },
} as const;

/** Report files stay in R2. All discovery and viewing goes through the admin wrapper. */
export const reportsRouter = createTRPCRouter({
  create: adminProcedure
    .input(createReportSchema)
    .mutation(async ({ ctx, input }) => {
      const conversation = await ctx.db.willGptConversation.findUnique({
        where: { id: input.conversationId },
        select: { userId: true },
      });
      if (conversation?.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Create reports from your own conversation.",
        });
      }
      let html: string;
      try {
        html = reportDocument(input.title, input.html);
      } catch (cause) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            cause instanceof Error ? cause.message : "Invalid report HTML.",
          cause,
        });
      }
      const id = randomUUID();
      const objectKey = `reports/${id}/${randomUUID()}.bin`;
      await putBuffer({
        key: objectKey,
        body: encryptReport(html, id, env.BETTER_AUTH_SECRET),
        contentType: "application/octet-stream",
        cacheControl: "private, no-store",
      });
      try {
        const report = await ctx.db.htmlReport.create({
          data: {
            id,
            title: input.title,
            objectKey,
            byteSize: Buffer.byteLength(html, "utf8"),
            userId: ctx.user.id,
            conversationId: input.conversationId,
          },
          select: reportSelect,
        });
        return { ...report, url: `/admin/reports/${report.id}` };
      } catch (error) {
        await deleteObject(objectKey).catch(() => undefined);
        throw error;
      }
    }),

  list: adminProcedure
    .input(
      z.object({
        search: z.string().trim().max(200).default(""),
        userId: z.string().optional(),
        cursor: z.uuid().optional(),
        limit: z.number().int().min(1).max(100).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.htmlReport.findMany({
        where: {
          ...(input.search
            ? {
                title: { contains: input.search, mode: "insensitive" as const },
              }
            : {}),
          ...(input.userId ? { userId: input.userId } : {}),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        cursor: input.cursor ? { id: input.cursor } : undefined,
        take: input.limit + 1,
        select: reportSelect,
      });
      const next = rows.length > input.limit ? rows.pop() : undefined;
      return { rows, nextCursor: next?.id ?? null };
    }),

  people: adminProcedure.query(({ ctx }) =>
    ctx.db.user.findMany({
      where: { htmlReports: { some: {} } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ),

  byId: adminProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const report = await ctx.db.htmlReport.findUnique({
        where: { id: input.id },
        select: { ...reportSelect, objectKey: true },
      });
      if (!report)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Report not found.",
        });
      try {
        const { objectKey, ...metadata } = report;
        const html = decryptReport(
          await getObjectBuffer(objectKey),
          report.id,
          env.BETTER_AUTH_SECRET,
        );
        return { ...metadata, html };
      } catch (cause) {
        console.error("[Reports] Could not load report", report.id, cause);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not load this report. Please try again.",
          cause,
        });
      }
    }),
});
