import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import { readHtml } from "./web-page";

describe("readHtml", () => {
  const html = `<html><head>
    <title>Fallback</title>
    <meta content="Peggy Gou (&#064;peggygou_)" property="og:title">
    <meta name="description" content="DJ &amp; producer">
    <meta property="og:image" content="/share.jpg?a=1&amp;b=2">
    <script>window.secret = "not text";</script>
    <style>p { color: red }</style>
  </head><body>
    <h1>Line-up</h1><p>Friday&nbsp;night</p>
    <img src="https://cdn.example.com/a.webp"><img src="/share.jpg?a=1&amp;b=2">
    <img src="data:image/png;base64,AAAA">
  </body></html>`;
  const page = readHtml(html, "https://example.com/gigs/1");

  test("reads the share tags, decoded, in either attribute order", () => {
    assert.equal(page.title, "Peggy Gou (@peggygou_)");
    assert.equal(page.description, "DJ & producer");
    assert.equal(page.image, "https://example.com/share.jpg?a=1&b=2");
  });

  test("lists images as unique absolute web URLs, share image first", () => {
    assert.deepEqual(page.images, [
      "https://example.com/share.jpg?a=1&b=2",
      "https://cdn.example.com/a.webp",
    ]);
  });

  test("keeps the visible text and drops scripts and styles", () => {
    assert.equal(page.text, "Line-up\nFriday night");
  });
});
