import { describe, expect, test } from "bun:test";
import {
  dropHomeTile,
  layoutHomeContent,
  placementSlots,
  tileSpan,
} from "./home-content";

const item = (id: string, video = false) => ({
  id,
  linkType: video ? "YOUTUBE_VIDEO" : "OTHER",
  link: video
    ? "https://youtu.be/GeHLBAvSPqs"
    : "https://soundcloud.com/atmosmedia",
  embedUrl: null,
});
// Newest first, as the router sends them.
const items = [
  item("a"),
  item("v1", true),
  item("b"),
  item("v2", true),
  item("c"),
  item("d"),
  item("e"),
];
const byId = new Map(items.map((i) => [i.id, i]));
const spanOf = (id: string) => tileSpan(byId.get(id)!);
const layout = (slots: { slot: number; contentItemId: string }[]) =>
  layoutHomeContent(items, slots).map((t) => `${t.slot}:${t.item.id}`);

describe("home content layout", () => {
  test("fills an empty grid with the newest content that fits each cell", () => {
    // a at 0, v1 spans 1-2, b at 3, v2 spans 4-5.
    expect(layout([])).toEqual(["0:a", "1:v1", "3:b", "4:v2"]);
  });

  test("keeps saved slots and fills the rest, skipping overlaps and bad slots", () => {
    expect(
      layout([
        { slot: 2, contentItemId: "v1" }, // runs off the row
        { slot: 0, contentItemId: "v2" },
        { slot: 1, contentItemId: "c" }, // under v2
        { slot: 5, contentItemId: "missing" },
        { slot: 4, contentItemId: "v2" }, // repeat
        { slot: 3, contentItemId: "e" },
      ]),
    ).toEqual(["0:v2", "2:a", "3:e", "4:v1"]);
    expect(layoutHomeContent(items, []).every((t) => t.auto)).toBe(true);
  });

  test("maps the old video-above-three layout onto the grid", () => {
    expect(
      placementSlots([
        { section: "VIDEO", sortOrder: 0, contentItemId: "v2" },
        { section: "ITEMS", sortOrder: 0, contentItemId: "c" },
        { section: "ITEMS", sortOrder: 2, contentItemId: "e" },
      ]),
    ).toEqual([
      { slot: 0, contentItemId: "v2" },
      { slot: 2, contentItemId: "c" },
      { slot: 4, contentItemId: "e" },
    ]);
  });
});

describe("dropping a tile", () => {
  const drop = (
    slots: { slot: number; contentItemId: string }[],
    id: string,
    slot: number,
  ) =>
    dropHomeTile(slots, byId.get(id)!, slot, spanOf).map(
      (s) => `${s.slot}:${s.contentItemId}`,
    );

  test("swaps two squares", () => {
    expect(
      drop(
        [
          { slot: 0, contentItemId: "a" },
          { slot: 3, contentItemId: "b" },
        ],
        "a",
        3,
      ),
    ).toEqual(["0:b", "3:a"]);
  });

  test("a video dropped on a row's last cell starts a cell earlier and moves what it covers", () => {
    expect(
      drop(
        [
          { slot: 0, contentItemId: "v1" },
          { slot: 4, contentItemId: "b" },
          { slot: 5, contentItemId: "c" },
        ],
        "v1",
        5,
      ),
    ).toEqual(["0:b", "1:c", "4:v1"]);
  });

  test("takes tiles off the grid when nothing else has room", () => {
    const full = [
      { slot: 0, contentItemId: "v1" },
      { slot: 2, contentItemId: "a" },
      { slot: 3, contentItemId: "v2" },
      { slot: 5, contentItemId: "b" },
    ];
    expect(drop(full, "c", 1)).toEqual(["1:c", "2:a", "3:v2", "5:b"]);
  });
});
