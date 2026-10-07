/**
 * Idempotent seed for artist profile themes:
 *   1. Ensures a system theme exists for each starter in `THEME_PRESETS`
 *      (matched by name), keeping its tokens in step with the preset.
 *   2. Rewrites any theme still stored under the old token model into the
 *      current one, through `parseTheme` (the same mapping the site reads
 *      them with, so nothing changes visually).
 *   3. Points profiles without a theme at the "Atmos" starter.
 *
 *   bun run db:seed-themes
 */
import { db } from "~/server/db";
import { THEME_PRESETS, parseTheme, zArtistTheme } from "~/lib/artist-theme";

async function main() {
  console.log("Seeding artist profile starter themes...");
  const ids: Record<string, string> = {};
  for (const [key, preset] of Object.entries(THEME_PRESETS)) {
    const existing = await db.artistProfileTheme.findFirst({
      where: { name: preset.name, isSystem: true },
      select: { id: true },
    });
    const theme = existing
      ? await db.artistProfileTheme.update({
          where: { id: existing.id },
          data: { tokens: preset.theme, description: preset.description },
          select: { id: true },
        })
      : await db.artistProfileTheme.create({
          data: {
            name: preset.name,
            description: preset.description,
            ownerUserId: null,
            isPublic: true,
            isSystem: true,
            tokens: preset.theme,
          },
          select: { id: true },
        });
    ids[key] = theme.id;
    console.log(`  ✓ ${preset.name} (${theme.id})`);
  }

  console.log("Converting themes saved under the old token model...");
  const themes = await db.artistProfileTheme.findMany({
    select: { id: true, name: true, tokens: true },
  });
  let converted = 0;
  for (const theme of themes) {
    if (zArtistTheme.safeParse(theme.tokens).success) continue;
    await db.artistProfileTheme.update({
      where: { id: theme.id },
      data: { tokens: parseTheme(theme.tokens), blockOverrides: {} },
    });
    converted += 1;
    console.log(`  ↳ ${theme.name}`);
  }
  console.log(`  ${converted} theme(s) converted`);

  const backfilled = await db.artistProfile.updateMany({
    where: { themeId: null },
    data: { themeId: ids.atmos },
  });
  console.log(`  ${backfilled.count} profile(s) given the Atmos theme`);
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
