import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { hireFieldsSchema, performerFieldsSchema } from "~/lib/contracts";
import { saveHireContract, savePerformerContract } from "~/server/contracts";
import { ContractStatus } from "~Prisma/client";

const target = {
  /** The `GigSetArtist` or `Rental` the contract is generated from, if it still exists. */
  sourceId: z.string().min(1).nullable(),
  /** The saved contract, once there is one. */
  contractId: z.string().min(1).nullable(),
  status: z.enum(ContractStatus),
};

export const contractsRouter = createTRPCRouter({
  /**
   * Save a contract from its page: the fields as they stand and the status
   * it is in. `fields` is null when only the status is changing, which is
   * all a sent or signed contract allows. See `~/server/contracts`.
   */
  save: adminProcedure
    .input(
      z.discriminatedUnion("kind", [
        z.object({
          kind: z.literal("PERFORMER"),
          ...target,
          fields: performerFieldsSchema.nullable(),
        }),
        z.object({
          kind: z.literal("HIRE"),
          ...target,
          fields: hireFieldsSchema.nullable(),
        }),
      ]),
    )
    .mutation(({ ctx, input }) =>
      input.kind === "PERFORMER"
        ? savePerformerContract({ ...input, userId: ctx.user.id })
        : saveHireContract({ ...input, userId: ctx.user.id }),
    ),
});
