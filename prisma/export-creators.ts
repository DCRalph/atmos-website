/**
 * Exports the creator directory for another site to import: display name,
 * handle, instagram link and profile photo for every creator profile.
 *
 *   bun prisma/export-creators.ts [out-dir]     (default: ./creator-export)
 *
 * Writes `<out-dir>/creators.json` plus each avatar under `<out-dir>/avatars/`.
 * Avatars are downloaded over their public URLs, so the bucket (or MinIO) must
 * be reachable from this machine. The matching importer lives in
 * poneke-promoters: `bun run creators:import <out-dir>/creators.json`.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { resolveSocialPlatform } from "~/lib/social-pills";
import { db } from "~/server/db";

const outDir = path.resolve(process.argv[2] ?? "creator-export");
const avatarsDir = path.join(outDir, "avatars");

type ExportedCreator = {
  name: string;
  handle: string;
  instagram: string | null;
  /** Path relative to creators.json, e.g. "avatars/kotiro.webp". */
  avatar: string | null;
};

async function downloadAvatar(
  handle: string,
  avatarFileId: string,
): Promise<string | null> {
  const file = await db.file_upload.findUnique({ where: { id: avatarFileId } });
  if (!file || file.status !== "OK") return null;

  const res = await fetch(file.url);
  if (!res.ok) {
    console.warn(
      `  ⚠ ${handle}: avatar fetch failed (${res.status}) ${file.url}`,
    );
    return null;
  }

  const extension = path.extname(file.key) || ".bin";
  const relative = `avatars/${handle}${extension}`;
  await writeFile(
    path.join(outDir, relative),
    Buffer.from(await res.arrayBuffer()),
  );
  return relative;
}

async function main() {
  const profiles = await db.creatorProfile.findMany({
    orderBy: { displayName: "asc" },
    select: {
      handle: true,
      displayName: true,
      avatarFileId: true,
      socials: {
        select: { platform: true, url: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  await mkdir(avatarsDir, { recursive: true });

  const creators: ExportedCreator[] = [];
  for (const profile of profiles) {
    // `platform` is free text, so resolve it the same way the site does.
    const instagram =
      profile.socials.find(
        (s: { platform: string; url: string }) =>
          resolveSocialPlatform(s.platform, s.url)?.id === "instagram",
      )?.url ?? null;

    const avatar = profile.avatarFileId
      ? await downloadAvatar(profile.handle, profile.avatarFileId)
      : null;

    creators.push({
      name: profile.displayName,
      handle: profile.handle,
      instagram,
      avatar,
    });
    console.log(
      `  ${profile.displayName} (@${profile.handle})` +
        `${instagram ? " · instagram" : ""}${avatar ? " · avatar" : ""}`,
    );
  }

  await writeFile(
    path.join(outDir, "creators.json"),
    JSON.stringify({ source: "atmos-website", creators }, null, 2),
  );
  console.log(`\nExported ${creators.length} creator(s) to ${outDir}`);
}

main()
  .catch((e) => {
    console.error("Export failed:", e);
    process.exitCode = 1;
  })
  .finally(() => {
    void db.$disconnect();
  });
