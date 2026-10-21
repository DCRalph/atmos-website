import { describe, expect, test } from "bun:test";
import { selectHomeContent } from "./home-content";

const item = (id: string, video = false) => ({
  id,
  linkType: video ? "YOUTUBE_VIDEO" : "OTHER",
  link: video
    ? "https://youtu.be/GeHLBAvSPqs"
    : "https://soundcloud.com/atmosmedia",
  embedUrl: null,
});
const items = [
  item("a"),
  item("b", true),
  item("c", true),
  item("d"),
  item("e"),
];

describe("home content selection", () => {
  test("automatically chooses a playable YouTube video and three distinct items", () => {
    const result = selectHomeContent(items, []);
    expect(result.video?.id).toBe("b");
    expect(result.items.map((i) => i.id)).toEqual(["a", "c", "d"]);
  });

  test("respects saved video and item order, excludes the video and fills gaps", () => {
    const result = selectHomeContent(items, [
      { section: "VIDEO", contentItemId: "c" },
      { section: "ITEMS", contentItemId: "e" },
      { section: "ITEMS", contentItemId: "c" },
      { section: "ITEMS", contentItemId: "missing" },
      { section: "ITEMS", contentItemId: "e" },
    ]);
    expect(result.video?.id).toBe("c");
    expect(result.items.map((i) => i.id)).toEqual(["e", "a", "b"]);
  });

  test("replaces a legacy non-video placement with a playable video", () => {
    expect(
      selectHomeContent(items, [{ section: "VIDEO", contentItemId: "a" }]).video
        ?.id,
    ).toBe("b");
  });

  test("handles no content, no videos and fewer than three remaining items", () => {
    expect(selectHomeContent([], [])).toEqual({ video: null, items: [] });
    expect(selectHomeContent([item("a")], [])).toEqual({
      video: null,
      items: [item("a")],
    });
    expect(selectHomeContent([item("b", true)], []).items).toEqual([]);
  });
});
