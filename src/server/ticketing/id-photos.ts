import "server-only";

import { randomUUID } from "node:crypto";

import { deleteObject, putBuffer } from "~/server/uploads/s3";

/**
 * Where the portrait off an ID card lives.
 *
 * Deliberately **not** the `uploadPresets` / `file_upload` path every other
 * image in this codebase uses. That path ends at `/api/media/[id]`, which
 * serves any completed file to anyone who asks and tells them to cache it for a
 * year. Correct for a gig poster; indefensible for a photograph of a member of
 * the public who has no account here and did not choose to be in our database.
 * These objects are private, unindexed, reachable only through a route that
 * re-checks door access on every request, and deleted outright when the patron
 * record expires.
 *
 * Only the face is ever stored — never the whole card. The crop happens on the
 * device, before anything is transmitted, so the address and the licence
 * classes are gone by the time this file sees anything.
 *
 * The bytes come in through tRPC rather than a presigned upload, which is the
 * opposite of how the rest of the app moves images. A cropped face at 480px is
 * forty kilobytes: a presign round trip would cost the door more latency than
 * the transfer saves, and it would need the patron's identity settled *before*
 * the upload it was meant to precede.
 */

/** A portrait crop is small; anything larger is the whole card by mistake. */
const MAX_PORTRAIT_BYTES = 1024 * 1024;

/** The per-patron prefix makes "delete everything about this person" one sweep. */
function portraitKey(patronId: string): string {
  return `door/id/${patronId}/${randomUUID()}.jpg`;
}

/**
 * Store a captured portrait against a patron.
 *
 * Returns the new key, or null when nothing usable arrived. Every failure here
 * is swallowed: a dropped photo must not fail the ID check that was the point
 * of the exercise, so the door simply gets a record without a picture.
 */
export async function storePortrait({
  patronId,
  base64,
  replacing,
}: {
  patronId: string;
  /** JPEG, base64, no data-URI prefix. */
  base64: string;
  /** The portrait this one supersedes, deleted once the new one is in place. */
  replacing?: string | null;
}): Promise<string | null> {
  try {
    const body = Buffer.from(stripDataUri(base64), "base64");
    if (body.length === 0 || body.length > MAX_PORTRAIT_BYTES) return null;
    // Cheap sanity check that this is a JPEG and not, say, a PNG of a whole
    // card: every JPEG starts FF D8 FF.
    if (body[0] !== 0xff || body[1] !== 0xd8 || body[2] !== 0xff) return null;

    const key = portraitKey(patronId);
    await putBuffer({
      key,
      body,
      contentType: "image/jpeg",
      acl: "private",
      // Belt and braces alongside the route's own headers: if the bucket is
      // ever fronted by a CDN, the object itself says not to keep a copy.
      cacheControl: "private, no-store",
    });

    if (replacing && replacing !== key) {
      await deleteObject(replacing).catch(() => undefined);
    }
    return key;
  } catch (cause) {
    console.error("[id-check] portrait could not be stored", cause);
    return null;
  }
}

function stripDataUri(value: string): string {
  const comma = value.indexOf(",");
  return value.startsWith("data:") && comma > 0
    ? value.slice(comma + 1)
    : value;
}

/** Delete a patron's portrait. Used by the nightly purge and by an erasure request. */
export async function deletePortrait(key: string | null): Promise<void> {
  if (!key) return;
  await deleteObject(key).catch(() => undefined);
}
