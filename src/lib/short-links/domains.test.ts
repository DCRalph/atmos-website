import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import { hostProblem, isMainSiteHost, normaliseHost } from "./domains";

describe("normaliseHost", () => {
  test("reduces a pasted URL or Host header to the bare host", () => {
    assert.equal(
      normaliseHost(" https://WWW.Atms.nz:443/vol3?x=1 "),
      "atms.nz",
    );
    assert.equal(normaliseHost("atms.nz:3000"), "atms.nz");
  });
});

describe("isMainSiteHost", () => {
  // Everything else is sent to the short link handler by `src/proxy.ts`, so a
  // miss here would redirect the real site to its own home page.
  test("knows the site in production, previews and dev", () => {
    const site = "https://atmosmedia.co.nz";
    assert.ok(isMainSiteHost("www.atmosmedia.co.nz", site));
    assert.ok(isMainSiteHost("atmos-website-git-x.vercel.app", site));
    assert.ok(isMainSiteHost("localhost:3000", site));
    assert.ok(
      isMainSiteHost("staging.example.com", "https://staging.example.com"),
    );
    assert.equal(isMainSiteHost("atms.nz", site), false);
  });
});

describe("hostProblem", () => {
  test("refuses things that aren't extra domains", () => {
    assert.equal(hostProblem("atms.nz"), null);
    assert.equal(hostProblem("go.atmos.events"), null);
    assert.ok(hostProblem(""));
    assert.ok(hostProblem("atms"));
    assert.ok(hostProblem("atmosmedia.co.nz"));
    assert.ok(hostProblem("x.vercel.app"));
  });
});
