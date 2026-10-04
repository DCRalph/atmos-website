import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import { readClient, resolveSource } from "./clicks";

const INSTAGRAM_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 337.0.3.23.54";
const CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const EDGE_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0";

describe("readClient", () => {
  // Each of these claims to be a more common browser too; the specific one
  // has to win or every story click reads as Safari.
  test("names the most specific browser a user agent claims", () => {
    assert.deepEqual(readClient(INSTAGRAM_IOS, null), {
      device: "mobile",
      os: "iOS",
      browser: "Instagram",
    });
    assert.deepEqual(readClient(CHROME_ANDROID, null), {
      device: "mobile",
      os: "Android",
      browser: "Chrome",
    });
    assert.deepEqual(readClient(EDGE_WINDOWS, null), {
      device: "desktop",
      os: "Windows",
      browser: "Edge",
    });
  });

  test("marks link preview fetchers as bots", () => {
    assert.equal(readClient("facebookexternalhit/1.1", null).device, "bot");
    assert.equal(readClient("WhatsApp/2.23.20.0", null).device, "bot");
  });
});

describe("resolveSource", () => {
  test("prefers a tag over the referrer", () => {
    assert.equal(resolveSource("Poster", "https://l.instagram.com/"), "poster");
  });

  test("names known referrers and falls back to the host or direct", () => {
    assert.equal(resolveSource(null, "https://l.instagram.com/"), "instagram");
    assert.equal(
      resolveSource(null, "https://www.undertheradar.co.nz/x"),
      "undertheradar.co.nz",
    );
    assert.equal(resolveSource(null, null), "direct");
    assert.equal(resolveSource(null, "not a url"), "direct");
  });
});
