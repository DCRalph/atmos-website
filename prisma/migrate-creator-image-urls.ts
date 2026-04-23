/**
 * One-shot migration that renames the legacy image URL fields in
 * `CreatorProfileTheme.tokens` and `CreatorBlock.data` to their new
 * `file_upload.id`-based equivalents.
 *
 * Because we are switching storage from raw URL strings to file upload ids,
 * any existing URL values are dropped (there is no way to re-create a
 * `file_upload` row from an arbitrary external URL). The feature is still
 * in-flight so this is expected to be safe in practice.
 *
 * Changes:
 *   - CreatorProfileTheme.tokens:
 *       pageBgImageUrl  ->  pageBgImageFileId: null   (legacy key removed)
 *   - CreatorBlock.data (IMAGE blocks):
 *       url             ->  fileId: null              (alt preserved)
 *   - CreatorBlock.data (GALLERY blocks):
 *       urls            ->  fileIds: []               (legacy key removed)
 *
 * Run manually once after deploying:
 *   bun prisma/migrate-creator-image-urls.ts
 */
import { db } from "~/server/db";

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function migrateThemes(): Promise<number> {
  const themes = await db.creatorProfileTheme.findMany({
    select: { id: true, tokens: true },
  });
  let updated = 0;
  for (const theme of themes) {
    const tokens = isObject(theme.tokens) ? { ...theme.tokens } : {};
    const hadLegacyKey = "pageBgImageUrl" in tokens;
    const hasNewKey = "pageBgImageFileId" in tokens;
    if (!hadLegacyKey && hasNewKey) continue;
    delete tokens.pageBgImageUrl;
    if (!hasNewKey) {
      tokens.pageBgImageFileId = null;
    }
    await db.creatorProfileTheme.update({
      where: { id: theme.id },
      data: { tokens: tokens as object },
    });
    updated += 1;
  }
  return updated;
}

async function migrateBlocks(): Promise<{ images: number; galleries: number }> {
  const blocks = await db.creatorBlock.findMany({
    where: { type: { in: ["IMAGE", "GALLERY"] } },
    select: { id: true, type: true, data: true },
  });
  let images = 0;
  let galleries = 0;
  for (const block of blocks) {
    const data = isObject(block.data) ? { ...block.data } : {};
    if (block.type === "IMAGE") {
      const hadLegacy = "url" in data;
      const hasNew = "fileId" in data;
      if (!hadLegacy && hasNew) continue;
      delete data.url;
      if (!hasNew) data.fileId = null;
      if (!("alt" in data)) data.alt = "";
      await db.creatorBlock.update({
        where: { id: block.id },
        data: { data: data as object },
      });
      images += 1;
    } else {
      const hadLegacy = "urls" in data;
      const hasNew = "fileIds" in data;
      if (!hadLegacy && hasNew) continue;
      delete data.urls;
      if (!hasNew) data.fileIds = [];
      await db.creatorBlock.update({
        where: { id: block.id },
        data: { data: data as object },
      });
      galleries += 1;
    }
  }
  return { images, galleries };
}

async function main() {
  console.log("Migrating creator image URL fields to file-id storage...");
  const themes = await migrateThemes();
  console.log(`  ↳ ${themes} theme(s) updated`);
  const { images, galleries } = await migrateBlocks();
  console.log(
    `  ↳ ${images} IMAGE block(s) and ${galleries} GALLERY block(s) updated`,
  );
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => {
    void db.$disconnect();
  });
