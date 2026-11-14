import { z } from "zod";

import {
  adminProcedure,
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";
import {
  hireFieldsSchema,
  performerFieldsSchema,
  signatureNameSchema,
} from "~/lib/contracts";
import {
  ensurePaymentTask,
  sendContract,
  signContract,
} from "~/server/contract-signing";
import { saveHireContract, savePerformerContract } from "~/server/contracts";
import { enforceRateLimit } from "~/server/ticketing/rate-limit";
import { getRequestMetadata } from "~/server/utils/activity-log";
import { ContractStatus } from "~Prisma/client";

const target = {
  /** The `GigSetArtist` or `Rental` the contract is generated from, if it still exists. */
  sourceId: z.string().min(1).nullable(),
  /** The saved contract, once there is one. */
  contractId: z.string().min(1).nullable(),
};

/** A contract and its page's form. `fields` is null when the form is frozen or is not being sent. */
const contractInput = <Extra extends z.ZodRawShape>(extra: Extra) =>
  z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("PERFORMER"),
      ...target,
      ...extra,
      fields: performerFieldsSchema.nullable(),
    }),
    z.object({
      kind: z.literal("HIRE"),
      ...target,
      ...extra,
      fields: hireFieldsSchema.nullable(),
    }),
  ]);

export const contractsRouter = createTRPCRouter({
  /**
   * Save a contract from its page: the fields as they stand and the status
   * it is in. `fields` is null when only the status is changing, which is
   * all a sent or signed contract allows. See `~/server/contracts`.
   *
   * A performer agreement set to sent or signed by hand (it went out on
   * paper) gets its payment task here, as one sent by email does.
   */
  save: adminProcedure
    .input(contractInput({ status: z.enum(ContractStatus) }))
    .mutation(async ({ ctx, input }) => {
      const stored =
        input.kind === "PERFORMER"
          ? await savePerformerContract({ ...input, userId: ctx.user.id })
          : await saveHireContract({ ...input, userId: ctx.user.id });
      if (stored.status !== "DRAFT") {
        await ensurePaymentTask(stored.id, ctx.user.id);
      }
      return stored;
    }),

  /**
   * Email a contract to its other party to sign, or again as a reminder.
   * From its page, `fields` is the form and is saved first. From the
   * Contracts list, `fields` is null and the saved contract goes as it is.
   */
  send: adminProcedure
    .input(contractInput({}))
    .mutation(({ ctx, input }) => sendContract(input, ctx.user)),

  /**
   * Sign a contract from the link it was emailed with. Public: the token is
   * the credential. `details` is the signer's own fields from the page.
   */
  sign: publicProcedure
    .input(
      z.object({
        token: z.string().min(20).max(200),
        name: signatureNameSchema,
        agreed: z.literal(true),
        details: z.record(z.string(), z.unknown()),
      }),
    )
    .mutation(async ({ input }) => {
      await enforceRateLimit({
        key: `contract-sign:${input.token}`,
        limit: 10,
        windowSeconds: 600,
      });
      const { ipAddress, userAgent } = await getRequestMetadata();
      await signContract({
        token: input.token,
        name: input.name,
        details: input.details,
        ip: ipAddress,
        userAgent,
      });
    }),
});
