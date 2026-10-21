import { describe, test } from "bun:test";
import assert from "node:assert/strict";
import { getYouTubeId } from "./youtube";

describe("getYouTubeId", () => {
  for (const value of [
    "GeHLBAvSPqs",
    "https://youtu.be/GeHLBAvSPqs?si=shared",
    "https://www.youtube.com/watch?v=GeHLBAvSPqs&t=10",
    "youtube.com/shorts/GeHLBAvSPqs",
    "https://m.youtube.com/live/GeHLBAvSPqs",
    "https://www.youtube-nocookie.com/embed/GeHLBAvSPqs",
  ]) {
    test(`extracts a valid video ID from ${value}`, () => {
      assert.equal(getYouTubeId(value), "GeHLBAvSPqs");
    });
  }
  for (const value of [
    null,
    "",
    "https://notyoutube.com/watch?v=GeHLBAvSPqs",
    "https://youtube.com.evil.test/watch?v=GeHLBAvSPqs",
    "https://youtu.be/invalid",
    "https://youtube.com/playlist?list=GeHLBAvSPqs",
    "javascript:alert(1)",
  ]) {
    test(`rejects unsupported or invalid input ${value}`, () => {
      assert.equal(getYouTubeId(value), null);
    });
  }
});
