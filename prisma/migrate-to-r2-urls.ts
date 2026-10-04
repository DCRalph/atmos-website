/**
 * One-shot migration that points stored S3 URLs at the R2 bucket's public
 * domain, after the objects have been copied across with their keys intact.
 *
 * Changes:
 *   - file_upload.url  ->  rebuilt from `key` on `R2_PUBLIC_URL`
 *   - GigMedia.url     ->  S3 origin swapped for `R2_PUBLIC_URL` (legacy rows)
 *
 * Safe to re-run: rows already on R2 no longer match.
 *
 * Run manually once after switching the env vars:
 *   bun prisma/migrate-to-r2-urls.ts
 */
import { env } from "~/env";
import { db } from "~/server/db";

const S3_ORIGIN = "https://atmosmedia-temp.s3.ap-southeast-2.amazonaws.com";
const R2_ORIGIN = env.R2_PUBLIC_URL.replace(/\/$/, "");

async function migrateFileUploads(): Promise<number> {
  const rows = await db.file_upload.findMany({
    where: { url: { startsWith: S3_ORIGIN } },
    select: { id: true, key: true },
  });
  for (const row of rows) {
    await db.file_upload.update({
      where: { id: row.id },
      data: { url: `${R2_ORIGIN}/${row.key}` },
    });
  }
  return rows.length;
}

async function migrateGigMedia(): Promise<number> {
  const rows = await db.gigMedia.findMany({
    where: { url: { startsWith: S3_ORIGIN } },
    select: { id: true, url: true },
  });
  for (const row of rows) {
    await db.gigMedia.update({
      where: { id: row.id },
      data: { url: row.url?.replace(S3_ORIGIN, R2_ORIGIN) },
    });
  }
  return rows.length;
}

const files = await migrateFileUploads();
const media = await migrateGigMedia();
console.log(`Rewrote ${files} file_upload and ${media} GigMedia URLs.`);
await db.$disconnect();
