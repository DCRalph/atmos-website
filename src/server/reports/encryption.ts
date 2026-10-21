import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const keyFor = (secret: string) =>
  createHash("sha256")
    .update("atmos-html-reports-v1\0")
    .update(secret)
    .digest();

/** The media bucket is public. Store encrypted HTML so R2 cannot serve a standalone report or expose its data. */
export function encryptReport(
  html: string,
  id: string,
  secret: string,
): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFor(secret), iv);
  cipher.setAAD(Buffer.from(id));
  const ciphertext = Buffer.concat([
    cipher.update(html, "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([Buffer.from([1]), iv, cipher.getAuthTag(), ciphertext]);
}

export function decryptReport(
  body: Buffer,
  id: string,
  secret: string,
): string {
  if (body.length < 29 || body[0] !== 1)
    throw new Error("Invalid report data.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    keyFor(secret),
    body.subarray(1, 13),
  );
  decipher.setAAD(Buffer.from(id));
  decipher.setAuthTag(body.subarray(13, 29));
  return Buffer.concat([
    decipher.update(body.subarray(29)),
    decipher.final(),
  ]).toString("utf8");
}
