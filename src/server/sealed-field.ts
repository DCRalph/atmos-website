import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

/**
 * Encryption for a single sensitive column, so the value is not readable in
 * the database or its backups. AES-256-GCM, the same construction as stored
 * reports (`~/server/reports/encryption.ts`), under its own key.
 *
 * `context` ties a sealed value to the row it belongs to (pass the row's id):
 * a value copied onto another row will not open. The key is derived from
 * `secret`, so rotating that secret makes existing values unreadable.
 */

const keyFor = (secret: string) =>
  createHash("sha256")
    .update("atmos-sealed-field-v1\0")
    .update(secret)
    .digest();

/** Version byte, 12 byte IV, 16 byte tag, then the ciphertext, as base64. */
export function sealField(
  value: string,
  context: string,
  secret: string,
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFor(secret), iv);
  cipher.setAAD(Buffer.from(context));
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([
    Buffer.from([1]),
    iv,
    cipher.getAuthTag(),
    ciphertext,
  ]).toString("base64");
}

/** Throws if the value was tampered with, belongs to another row, or was sealed under another secret. */
export function openField(
  sealed: string,
  context: string,
  secret: string,
): string {
  const body = Buffer.from(sealed, "base64");
  if (body.length < 29 || body[0] !== 1)
    throw new Error("Invalid sealed value.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    keyFor(secret),
    body.subarray(1, 13),
  );
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(body.subarray(13, 29));
  return Buffer.concat([
    decipher.update(body.subarray(29)),
    decipher.final(),
  ]).toString("utf8");
}
