import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import {
  SITE_LINK_DOMAIN,
  hostProblem,
  isMainSiteHost,
  linkTarget,
  normaliseHost,
  shortLinkUrl,
} from "./domains";

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

  test("knows the extra names dev is opened on", () => {
    const site = "http://localhost:3000";
    const dev = ["my-box", "*.tailnet.ts.net", "100.64.0.1"];
    assert.ok(isMainSiteHost("my-box:3000", site, dev));
    assert.ok(isMainSiteHost("my-box.tailnet.ts.net:3000", site, dev));
    assert.ok(isMainSiteHost("100.64.0.1:3000", site, dev));
    assert.equal(isMainSiteHost("atms.nz", site, dev), false);
    assert.equal(isMainSiteHost("my-box", site), false);
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

describe("shortLinkUrl", () => {
  test("marks a QR code's address, after the sub link's code", () => {
    assert.equal(shortLinkUrl("atms.nz", "tix"), "https://atms.nz/tix");
    assert.equal(
      shortLinkUrl("atms.nz", "tix", { code: "k3x9p", qr: true }),
      "https://atms.nz/tix?c=k3x9p&qr=1",
    );
    assert.equal(
      shortLinkUrl("atms.nz", "tix", { qr: true }),
      "https://atms.nz/tix?qr=1",
    );
  });
});

describe("linkTarget", () => {
  const site = "https://atmosmedia.co.nz";

  // The photo signup attributes each email to the code in `?c=`, so losing it
  // here would put every signup under "no code".
  test("carries a sub link's code onto our own pages", () => {
    assert.equal(
      linkTarget("/gigs/abc/photo-signup", SITE_LINK_DOMAIN, "k3x9p", site),
      "/gigs/abc/photo-signup?c=k3x9p",
    );
    assert.equal(
      linkTarget("/gigs?tab=past#top", "atms.nz", "k3x9p", site),
      "https://atmosmedia.co.nz/gigs?tab=past&c=k3x9p#top",
    );
  });

  test("leaves somebody else's site exactly as saved", () => {
    assert.equal(
      linkTarget("https://example.com/x?y=1", "atms.nz", "k3x9p", site),
      "https://example.com/x?y=1",
    );
  });

  test("adds nothing without a code", () => {
    assert.equal(linkTarget("/merch", SITE_LINK_DOMAIN, null, site), "/merch");
    assert.equal(
      linkTarget("/merch", "atms.nz", null, site),
      "https://atmosmedia.co.nz/merch",
    );
  });
});
