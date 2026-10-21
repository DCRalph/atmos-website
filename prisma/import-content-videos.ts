import { db } from "~/server/db";
import { getYouTubeId } from "~/lib/youtube";

/**
 * Import the three Atmos TV videos, using their published titles and dates.
 * Run with --apply to save; add --home to select the latest video and arrange
 * the other two above the existing first home item. Re-runs reuse existing rows.
 *
 * bun prisma/import-content-videos.ts --apply --home
 */
const apply = process.argv.includes("--apply");
const arrangeHome = process.argv.includes("--home");
const videos = [
  {
    videoId: "GeHLBAvSPqs",
    title: "Hermitude @ San Fran 2026 | Atmos takeover",
    date: new Date("2026-08-04T00:50:57-07:00"),
    description: "",
  },
  {
    videoId: "jVewNAfVaOQ",
    title: "KUMI, CHRIS KEENE and MIKEYY | Atmos & Frenz",
    date: new Date("2026-06-21T04:52:36-07:00"),
    description:
      "KUMI, CHRIS KEENE and MIKEYY at San Fran for an unforgettable night of high energy dance music!",
  },
  {
    videoId: "CyGaKmyYUzs",
    title: "Atmos Boat Party",
    date: new Date("2026-06-20T22:05:09-07:00"),
    description: "",
  },
];

try {
  const existing = await db.contentItem.findMany({ orderBy: { date: "desc" } });
  for (const video of videos) {
    const match = existing.find(
      (item) =>
        getYouTubeId(item.link) === video.videoId ||
        getYouTubeId(item.embedUrl) === video.videoId,
    );
    console.log(`${match ? "Reuse" : "Add"}: ${video.title}`);
  }
  if (!apply) {
    console.log(
      "Dry run. Pass --apply to save and --home to arrange the home page.",
    );
  } else {
    await db.$transaction(async (tx) => {
      const importedIds: string[] = [];
      for (const { videoId, ...video } of videos) {
        const match = existing.find(
          (item) =>
            getYouTubeId(item.link) === videoId ||
            getYouTubeId(item.embedUrl) === videoId,
        );
        const item =
          match ??
          (await tx.contentItem.create({
            data: {
              id: `atmos-youtube-${videoId}`,
              ...video,
              type: "VIDEO",
              platform: "YouTube",
              linkType: "YOUTUBE_VIDEO",
              link: `https://www.youtube.com/watch?v=${videoId}`,
              embedUrl: videoId,
            },
          }));
        importedIds.push(item.id);
      }
      if (arrangeHome) {
        const [videoId, ...itemIds] = importedIds;
        if (!videoId) throw new Error("No home video was imported");
        const previous = await tx.homeContentPlacement.findFirst({
          where: { section: "ITEMS", contentItemId: { notIn: importedIds } },
          orderBy: { sortOrder: "asc" },
        });
        const thirdItemId =
          previous?.contentItemId ??
          existing.find((item) => !importedIds.includes(item.id))?.id;
        if (!thirdItemId)
          throw new Error("A third item is needed below the home video");
        itemIds.push(thirdItemId);
        await tx.homeContentPlacement.deleteMany({});
        await tx.homeContentPlacement.createMany({
          data: [
            { section: "VIDEO", contentItemId: videoId, sortOrder: 0 },
            ...itemIds.map((contentItemId, sortOrder) => ({
              section: "ITEMS" as const,
              contentItemId,
              sortOrder,
            })),
          ],
        });
      }
    });
    console.log(
      arrangeHome
        ? "Videos imported and home placements saved."
        : "Videos imported.",
    );
  }
} finally {
  await db.$disconnect();
}
