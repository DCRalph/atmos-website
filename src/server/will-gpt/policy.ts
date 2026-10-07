import type {
  AnyTRPCMutationProcedure,
  AnyTRPCProcedure,
  TRPCProcedureType,
} from "@trpc/server";

import type { Risk } from "~/lib/will-gpt";
import type { AppRouter } from "~/server/api/root";
import type { ProcedureMeta } from "~/server/api/trpc";

/**
 * What Will GPT may call, and which calls wait for the admin.
 *
 * The rule is by verb, so a procedure added later is classified without
 * anyone remembering to come here: queries read, mutations named like a plain
 * create or edit write, and every other mutation is destructive and asks
 * first. Asking first is the failure mode on purpose. An unfamiliar verb costs
 * the admin a click; the reverse costs them data, or an email to every ticket
 * holder.
 */

/** Mutation names that only add or edit. Checked after an `admin` prefix is dropped. */
const WRITE_VERB =
  /^(create|update|add|assign|reorder|move|duplicate|upsert|restore|link|bulkAdd|generate)/;

/** Every mutation's path, e.g. `"gigs.delete"`, so the overrides below are checked against the real API. */
type MutationPath<TRecord, TPrefix extends string = ""> = {
  [K in keyof TRecord & string]: TRecord[K] extends AnyTRPCProcedure
    ? TRecord[K] extends AnyTRPCMutationProcedure
      ? `${TPrefix}${K}`
      : never
    : MutationPath<TRecord[K], `${TPrefix}${K}.`>;
}[keyof TRecord & string];

/** Where the verb gets it wrong, in both directions. */
const OVERRIDES: Partial<Record<string, Risk>> = {
  // Named like a create or edit, but reaches people or changes access.
  "invites.create": "destructive",
  "lifetimeTickets.create": "destructive", // emails the holder by default
  "users.addPermission": "destructive",
  "creatorProfiles.linkUserToProfile": "destructive",
  "ticketAdmin.updateBuyer": "destructive", // moves the tickets to another email

  // Not named like an edit, but no more final than one.
  "gigs.setPosterFromUpload": "write",
  "homeGigs.setPlacements": "write",
  "homeGigs.setAllPlacements": "write",
  "homeContent.setPlacements": "write",
  "homeContent.setAllPlacements": "write",
  "creatorProfiles.saveLayout": "write",
  "creatorProfiles.setSocials": "write",
  "creatorProfiles.setAvatar": "write", // the old image is soft deleted, not gone
  "creatorProfiles.setBanner": "write",
  "uploads.importFromUrl": "write", // stores a file; attaching it is separate
  "gigImport.read": "write", // reads a post into a draft; publishing is separate
  "gigImport.resolveHandle": "write",
  "shopify.syncProducts": "write", // refreshes the cached catalogue from Shopify
} satisfies Partial<Record<MutationPath<AppRouter["_def"]["record"]>, Risk>>;

/**
 * Owner-or-admin procedures Will GPT is offered, since an admin may edit any
 * creator profile. Each falls back to the caller's own profile when its id is
 * left out, so a call must name one; the value is the input that must be set.
 */
const OWNER_SCOPED: Partial<Record<string, "profileId">> = {
  "creatorProfiles.updateProfile": "profileId",
  "creatorProfiles.setAvatar": "profileId",
  "creatorProfiles.setBanner": "profileId",
  "creatorProfiles.clearAvatar": "profileId",
  "creatorProfiles.clearBanner": "profileId",
  "creatorProfiles.setSocials": "profileId",
  "creatorProfiles.publish": "profileId",
  "creatorProfiles.unpublish": "profileId",
} satisfies Partial<
  Record<MutationPath<AppRouter["_def"]["record"]>, "profileId">
>;

/** Why a call to an owner-scoped procedure cannot run as written, or null. */
export function unscopedReason(
  path: string,
  input: Record<string, unknown> | undefined,
): string | null {
  const key = OWNER_SCOPED[path];
  if (!key || (typeof input?.[key] === "string" && input[key] !== "")) {
    return null;
  }
  return `Pass ${key}. Without it, ${path} edits the admin's own profile.`;
}

export function riskOf(path: string, type: TRPCProcedureType): Risk {
  if (type === "query") return "read";
  const override = OVERRIDES[path];
  if (override) return override;
  const name = (path.split(".").at(-1) ?? "").replace(
    /^admin([A-Z])/,
    (_, first: string) => first.toLowerCase(),
  );
  return WRITE_VERB.test(name) ? "write" : "destructive";
}

/**
 * Whether Will GPT is offered a procedure at all. Every read, since a read
 * runs as the admin and changes nothing, and many lists the admin works from
 * (crew, content) are public queries. Of the writes, only the staff surface:
 * whatever sits behind the admin or event organiser check, plus the creator
 * profile edits in `OWNER_SCOPED`. Customer actions like checkout or a ticket
 * holder editing their own ticket are not admin work, and Will GPT does not
 * get to call itself.
 */
export function isOffered(
  path: string,
  type: TRPCProcedureType,
  meta: ProcedureMeta | undefined,
) {
  if (path.startsWith("willGpt.")) return false;
  if (type === "query") return true;
  if (OWNER_SCOPED[path]) return true;
  return (
    type === "mutation" &&
    (meta?.permission === "ADMIN" || meta?.permission === "EVENT_ORGANISER")
  );
}
