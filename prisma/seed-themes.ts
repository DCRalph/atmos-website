/**
 * Idempotent seed script that:
 *   1. Ensures the two starter system themes ("Atmos Dark" and "Atmos Light") exist.
 *   2. Backfills `CreatorProfile.themeId` for any profile that doesn't already
 *      have one, using the legacy `theme` string (if it's still present in the
 *      database) as a hint.
 *
 * Run manually when rolling out the theme feature:
 *   bun prisma/seed-themes.ts
 */
import { db } from "~/server/db";
import {
  DEFAULT_BLOCK_OVERRIDES,
  DEFAULT_THEME_TOKENS,
  LIGHT_THEME_TOKENS,
} from "~/lib/creator-theme";

const DARK_NAME = "Atmos Dark";
const LIGHT_NAME = "Atmos Light";

async function upsertSystemTheme(
  name: string,
  description: string,
  tokens: object,
): Promise<{ id: string }> {
  // Identify the system theme by name + isSystem flag. We don't have a unique
  // constraint, so we do a manual findFirst-or-create dance (idempotent).
  const existing = await db.creatorProfileTheme.findFirst({
    where: { name, isSystem: true },
    select: { id: true },
  });
  if (existing) {
    return existing;
  }
  const created = await db.creatorProfileTheme.create({
    data: {
      name,
      description,
      ownerUserId: null,
      isPublic: true,
      isSystem: true,
      tokens: tokens as object,
      blockOverrides: DEFAULT_BLOCK_OVERRIDES as object,
    },
    select: { id: true },
  });
  return created;
}

async function main() {
  console.log("Seeding creator profile system themes...");

  const dark = await upsertSystemTheme(
    DARK_NAME,
    "The default dark Atmos look: deep background, subtle block surfaces, indigo accent.",
    DEFAULT_THEME_TOKENS,
  );
  const light = await upsertSystemTheme(
    LIGHT_NAME,
    "A bright light variant with crisp white block surfaces.",
    LIGHT_THEME_TOKENS,
  );

  console.log(
    `✓ System themes ready (dark=${dark.id}, light=${light.id})`,
  );

  // Backfill profiles without a themeId. We try to detect a legacy `theme`
  // column via a raw SQL probe — if it exists, map "light" → light theme,
  // otherwise dark. If the column is already dropped, everyone defaults to
  // dark.
  console.log("Backfilling CreatorProfile.themeId...");
  let legacyLightProfileIds: string[] = [];
  try {
    const rows = await db.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "creator_profile" WHERE "theme" = 'light' AND "themeId" IS NULL`,
    );
    legacyLightProfileIds = rows.map((r) => r.id);
  } catch {
    // `theme` column likely already dropped — fine, everyone will become dark.
  }

  if (legacyLightProfileIds.length) {
    await db.creatorProfile.updateMany({
      where: { id: { in: legacyLightProfileIds } },
      data: { themeId: light.id },
    });
    console.log(
      `  ↳ ${legacyLightProfileIds.length} profile(s) migrated to light theme`,
    );
  }

  const remaining = await db.creatorProfile.updateMany({
    where: { themeId: null },
    data: { themeId: dark.id },
  });
  console.log(`  ↳ ${remaining.count} profile(s) migrated to dark theme`);

  console.log("Theme seed complete.");
}

main()
  .catch((e) => {
    console.error("Error seeding themes:", e);
    process.exit(1);
  })
  .finally(() => {
    void db.$disconnect();
  });
