import { getYouTubeId } from "./youtube";

export const HOME_ITEM_COUNT = 3;

type HomeItem = {
  id: string;
  linkType: string;
  link: string;
  embedUrl: string | null;
};

export function contentVideoId(item: HomeItem) {
  return item.linkType === "YOUTUBE_VIDEO"
    ? (getYouTubeId(item.embedUrl) ?? getYouTubeId(item.link))
    : null;
}

/** Items arrive newest first; saved placements take priority over automatic fills. */
export function selectHomeContent<T extends HomeItem>(
  items: T[],
  placements: { section: "VIDEO" | "ITEMS"; contentItemId: string }[],
) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const savedVideo = placements
    .filter((p) => p.section === "VIDEO")
    .map((p) => byId.get(p.contentItemId))
    .find((item) => item && contentVideoId(item));
  const video =
    savedVideo ?? items.find((item) => contentVideoId(item)) ?? null;
  const selected = new Map<string, T>();
  for (const placement of placements.filter((p) => p.section === "ITEMS")) {
    const item = byId.get(placement.contentItemId);
    if (item && item.id !== video?.id) selected.set(item.id, item);
  }
  for (const item of items) {
    if (item.id !== video?.id && !selected.has(item.id)) {
      selected.set(item.id, item);
    }
    if (selected.size >= HOME_ITEM_COUNT) break;
  }
  return { video, items: [...selected.values()].slice(0, HOME_ITEM_COUNT) };
}
