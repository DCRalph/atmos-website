import "server-only";

import { randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { env } from "~/env";
import {
  formatContractDate,
  NO_DEFAULTS,
  paymentDueAt,
  performerColumns,
  performerFieldsSchema,
  signerFieldsSchema,
  tidyHireFields,
  tidyPerformerFields,
  type ContractSigning,
  type ContractTarget,
  type HireFields,
  type PerformerFields,
} from "~/lib/contracts";
import {
  contractSigningUrl,
  getContractDefaults,
  readHire,
  readPerformer,
  saveHireContract,
  savePerformerContract,
  sealPerformerSnapshot,
  setBaseline,
  writeBackHire,
  writeBackPerformer,
} from "~/server/contracts";
import { db } from "~/server/db";
import { sendEmail } from "~/server/email/send";
import { createTask } from "~/server/tasks/mutations";
import {
  renderContractInviteEmail,
  renderContractSignedEmail,
} from "~/server/ticketing/email/templates";
import { logActivity } from "~/server/utils/activity-log";
import { ActivityType, type ContractKind, type Prisma } from "~Prisma/client";

/**
 * Sending a contract to its other party and taking their signature.
 *
 * A contract is emailed with a link to `/contracts/<token>`. The token is the
 * only credential: whoever holds it can read the contract and, while it is
 * `SENT`, sign it by typing their name. Sending freezes the contract, so what
 * they sign is exactly what was sent, plus their own details, which they fill
 * in on the page (`SIGNER_FIELDS`).
 *
 * The admin side (`sendContract`) is only reached through an admin
 * procedure. `getSigningView` and `signContract` are public and trust nothing
 * but the token.
 */

const AGREEMENTS = {
  PERFORMER: "performer agreement",
  HIRE: "equipment hire agreement",
} as const satisfies Record<ContractKind, string>;

/** What a contract's emails say it is for, read from its fields. */
function emailSubject(
  contract:
    | { kind: "PERFORMER"; fields: PerformerFields }
    | { kind: "HIRE"; fields: HireFields },
) {
  if (contract.kind === "PERFORMER") {
    const { event, date, setTime } = contract.fields;
    return {
      subjectLine: event || "your set",
      summary: [date, setTime && `Set time ${setTime}`]
        .filter(Boolean)
        .join(". "),
    };
  }
  const { collectionDate, returnDate } = contract.fields;
  return {
    subjectLine: `${collectionDate} to ${returnDate}`,
    summary: "Equipment hire from Atmos",
  };
}

/** A saved contract with its fields parsed for its kind, or null if there is none to read. */
async function readSaved(target: ContractTarget, kind: ContractKind) {
  if (kind === "PERFORMER") {
    const read = await readPerformer(target, NO_DEFAULTS);
    return read?.contract && read.saved
      ? { kind, ...read, contract: read.contract, fields: read.saved }
      : null;
  }
  const read = await readHire(target, NO_DEFAULTS);
  return read?.contract && read.saved
    ? { kind, ...read, contract: read.contract, fields: read.saved }
    : null;
}

type Sender = { id: string; name: string; email: string };

/**
 * Email a contract to its other party for signature, or again as a reminder.
 *
 * `fields` is the contract page's form, saved first so that what is sent is
 * what is on screen. Null sends the contract as it was last saved, which is
 * how the Contracts list sends one without opening it. The contract only
 * becomes `SENT` once the email has gone, and a performer agreement with a
 * fee gets its payment task then.
 */
export async function sendContract(
  input:
    | (ContractTarget & { kind: "PERFORMER"; fields: PerformerFields | null })
    | (ContractTarget & { kind: "HIRE"; fields: HireFields | null }),
  sender: Sender,
) {
  const existing = await readSaved(input, input.kind);
  if (existing?.contract.status === "SIGNED") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This contract is already signed.",
    });
  }

  // A draft is saved as it stands on the page. A sent one is frozen, so a
  // reminder sends what was sent.
  let target: ContractTarget = input;
  if (input.fields && existing?.contract.status !== "SENT") {
    const save = { ...input, status: "DRAFT" as const, userId: sender.id };
    const stored =
      save.kind === "PERFORMER"
        ? await savePerformerContract(save)
        : await saveHireContract(save);
    target = { sourceId: input.sourceId, contractId: stored.id };
  }

  const saved = await readSaved(target, input.kind);
  if (!saved) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Save the contract before sending it.",
    });
  }
  const to = z.email().safeParse(saved.fields.email);
  if (!to.success) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Add an email address to the contract before sending it.",
    });
  }

  const { contract } = saved;
  const conflict = () =>
    new TRPCError({
      code: "CONFLICT",
      message:
        "The contract changed while it was being sent, so it is still a draft. Check it and send it again.",
    });

  // `revision` is the contract exactly as it was read above. Everything
  // written from here on is conditional on it, so the email can only ever
  // describe the contract that ends up sent.
  const token = contract.signToken ?? randomBytes(32).toString("base64url");
  let revision = contract.updatedAt;
  if (!contract.signToken) {
    const stamped = new Date();
    const { count } = await db.contract.updateMany({
      where: { id: contract.id, status: contract.status, updatedAt: revision },
      data: { signToken: token, updatedAt: stamped },
    });
    if (count === 0) throw conflict();
    revision = stamped;
  }

  const reminder = contract.status === "SENT";
  const result = await sendEmail({
    from: "contracts",
    to: to.data,
    replyTo: sender.email,
    ...renderContractInviteEmail({
      agreement: AGREEMENTS[saved.kind],
      ...emailSubject(saved),
      url: contractSigningUrl(token),
      sentBy: sender.name,
      reminder,
    }),
  });
  if (!result.ok) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `${reminder ? "The reminder could not be sent." : "The email could not be sent, so the contract is still a draft."} ${result.error ?? ""}`,
    });
  }

  // The email took a moment, and the contract may have moved in it. A
  // reminder never changes the status, so a signature that arrived meanwhile
  // stands. A first send only takes if nothing changed while it was going.
  const sent = { sentAt: new Date(), sentTo: to.data, sentByName: sender.name };
  const { count } = reminder
    ? await db.contract.updateMany({
        where: { id: contract.id, status: "SENT" },
        data: sent,
      })
    : await db.contract.updateMany({
        where: { id: contract.id, status: "DRAFT", updatedAt: revision },
        data: { ...sent, status: "SENT" },
      });
  if (count === 0 && !reminder) throw conflict();
  await ensurePaymentTask(contract.id, sender.id);

  await logActivity({
    type: ActivityType.CONTRACT_SENT,
    action: `${reminder ? "Reminder sent" : "Contract sent"} for signature: ${contract.title}`,
    details: { contractId: contract.id },
    userId: sender.id,
  });
  return { id: contract.id, sentTo: to.data, reminder };
}

/**
 * Make the task that reminds someone to pay a performer, once: when their
 * agreement is first sent or marked signed. It is due when clause 4.1 says
 * the fee is (`paymentDueAt`), sits on the gig, and belongs to `ownerId`, the
 * admin who issued the contract, until they hand it on. Its notes point at
 * the contract rather than repeat the fee, so they never go stale.
 *
 * Nothing happens for a hire agreement, a contract with no fee, or one whose
 * set has been removed from the line-up.
 */
export async function ensurePaymentTask(contractId: string, ownerId: string) {
  const contract = await db.contract.findUnique({
    where: { id: contractId },
    select: {
      kind: true,
      fields: true,
      paymentTaskId: true,
      setArtist: {
        select: {
          item: {
            select: {
              startsAt: true,
              gigId: true,
              gig: { select: { gigStartTime: true } },
            },
          },
        },
      },
    },
  });
  if (contract?.kind !== "PERFORMER" || contract.paymentTaskId) return;
  const item = contract.setArtist?.item;
  if (!item) return;
  const fields = performerFieldsSchema.parse(contract.fields);
  if (!performerColumns(fields).booking.feeCents) return;

  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const task = await createTask(
    {
      title: `Pay ${fields.stageName || "the performer"} for ${fields.event || "their set"}`,
      notes: `Their fee is due within 14 days of their set (clause 4.1 of the performer agreement). The fee and the bank account to pay are on the contract: ${base}/admin/contracts/performer?contract=${contractId}`,
      gigId: item.gigId,
      assigneeId: ownerId,
      dueAt: paymentDueAt(item.startsAt ?? item.gig.gigStartTime),
      // After the gig, so the gig's start is not a deadline for it.
      hardDeadlineAt: null,
      critical: false,
      proofRequired: false,
    },
    ownerId,
  );
  await db.contract.update({
    where: { id: contractId },
    data: { paymentTaskId: task.id },
  });
}

/** What the signing page shows for a token. */
export type SigningView = {
  /** `SENT` can be signed, `SIGNED` is the signed copy. A `DRAFT` is being changed and shows nothing. */
  status: "SENT" | "SIGNED" | "DRAFT";
  title: string;
  signing: ContractSigning;
} & (
  | { kind: "PERFORMER"; fields: PerformerFields }
  | { kind: "HIRE"; fields: HireFields }
);

/** The contract a signing link opens, or null if the token opens nothing. */
export async function getSigningView(
  token: string,
): Promise<SigningView | null> {
  const found = await db.contract.findUnique({
    where: { signToken: token },
    select: { id: true, kind: true },
  });
  if (!found) return null;
  const saved = await readSaved(
    { sourceId: null, contractId: found.id },
    found.kind,
  );
  if (!saved) return null;

  const { contract } = saved;
  const view = {
    status: contract.status,
    title: contract.title,
    signing: {
      url: contractSigningUrl(token),
      sentAt: contract.sentAt,
      sentTo: contract.sentTo,
      sentByName: contract.sentByName,
      signedAt: contract.signedAt,
      signedName: contract.signedName,
    },
  };
  return saved.kind === "PERFORMER"
    ? { ...view, kind: saved.kind, fields: saved.fields }
    : { ...view, kind: saved.kind, fields: saved.fields };
}

/**
 * Sign a sent contract from its link. `details` is the signer's own fields as
 * they typed them on the page; they go into the contract and back to the
 * rows they belong to, like an admin's edits would. The signature is the
 * name they typed, with when and where from.
 *
 * Only a `SENT` contract can be signed, and only once: the update is
 * conditional on the status, so two submissions cannot both win.
 */
export async function signContract({
  token,
  name,
  details,
  ip,
  userAgent,
}: {
  token: string;
  name: string;
  details: unknown;
  ip: string | null;
  userAgent: string | null;
}) {
  const found = await db.contract.findUnique({
    where: { signToken: token },
    select: { id: true, kind: true },
  });
  const saved = found
    ? await readSaved({ sourceId: null, contractId: found.id }, found.kind)
    : null;
  if (!saved) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "This link is no longer valid.",
    });
  }
  const { contract } = saved;
  if (contract.status !== "SENT") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        contract.status === "SIGNED"
          ? "This agreement has already been signed."
          : "This agreement is being updated. We will email you when it is ready to sign.",
    });
  }

  const signature = {
    status: "SIGNED" as const,
    signedAt: new Date(),
    signedName: name,
    signedIp: ip,
    signedUserAgent: userAgent?.slice(0, 500) ?? null,
  };
  /** Marks it signed with its final fields, unless someone got there first. */
  const sign = async (
    tx: Prisma.TransactionClient,
    fields: PerformerFields | HireFields,
  ) => {
    const { count } = await tx.contract.updateMany({
      where: { id: contract.id, status: "SENT" },
      data: { ...signature, fields },
    });
    if (count === 0) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "This agreement has already been signed.",
      });
    }
  };

  // What the signed copy's email says it is for, and where it goes.
  let subjectLine: string;
  let email: string;
  if (saved.kind === "PERFORMER") {
    const fields = tidyPerformerFields({
      ...saved.fields,
      ...signerFieldsSchema.PERFORMER.parse(details),
    });
    await db.$transaction(async (tx) => {
      if (saved.setArtist) {
        await writeBackPerformer(
          tx,
          saved.setArtist,
          saved.fields,
          fields,
          null,
        );
      }
      await sign(tx, sealPerformerSnapshot(fields));
    });
    const current = await readPerformer(
      { sourceId: saved.setArtist?.id ?? null, contractId: contract.id },
      await getContractDefaults(""),
    );
    if (current?.live) {
      await setBaseline(contract.id, sealPerformerSnapshot(current.live));
    }
    ({ subjectLine } = emailSubject({ kind: saved.kind, fields }));
    email = fields.email;
  } else {
    const fields = tidyHireFields({
      ...saved.fields,
      ...signerFieldsSchema.HIRE.parse(details),
    });
    await db.$transaction(async (tx) => {
      if (saved.rental) {
        await writeBackHire(tx, saved.rental.id, saved.fields, fields);
      }
      await sign(tx, fields);
    });
    const current = await readHire(
      { sourceId: saved.rental?.id ?? null, contractId: contract.id },
      await getContractDefaults(""),
    );
    if (current?.live) await setBaseline(contract.id, current.live);
    ({ subjectLine } = emailSubject({ kind: saved.kind, fields }));
    email = fields.email;
  }

  await logActivity({
    type: ActivityType.CONTRACT_SIGNED,
    action: `Contract signed by ${name}: ${contract.title}`,
    details: { contractId: contract.id },
    ipAddress: ip ?? undefined,
    userAgent: userAgent ?? undefined,
  });

  // Their copy. The contract is signed whether or not this arrives.
  const to = z.email().safeParse(contract.sentTo ?? email);
  if (to.success) {
    const result = await sendEmail({
      from: "contracts",
      to: to.data,
      ...renderContractSignedEmail({
        agreement: AGREEMENTS[saved.kind],
        subjectLine,
        signedName: name,
        signedOn: formatContractDate(signature.signedAt),
        url: contractSigningUrl(token),
      }),
    });
    if (!result.ok) {
      console.error("Failed to send the signed contract email:", result.error);
    }
  }
}
