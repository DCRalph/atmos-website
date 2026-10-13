import { describe, test } from "bun:test";
import assert from "node:assert/strict";

import { resolveCrewDisplay, type CrewMemberForDisplay } from "./crew-display";

const row: CrewMemberForDisplay = {
  id: "c1",
  name: "Row name",
  role: null,
  instagram: "https://www.instagram.com/row",
  soundcloud: null,
  image: "/crew_pfp/row.jpg",
};

const profile = {
  id: "p1",
  handle: "nova",
  displayName: "Nova",
  tagline: "DJ / Producer",
  avatarFileId: null,
  isPublished: true,
  socials: [{ platform: "Instagram", url: "https://www.instagram.com/nova" }],
};

describe("resolveCrewDisplay", () => {
  test("a linked row shows only the profile's name, photo and socials", () => {
    const display = resolveCrewDisplay({ ...row, artistProfile: profile });
    assert.equal(display.source, "profile");
    assert.equal(display.name, "Nova");
    assert.equal(display.instagram, "https://www.instagram.com/nova");
    // The row's own values are not mixed in, even where the profile has none.
    assert.equal(display.soundcloud, null);
    assert.equal(display.image, null);
    assert.equal(display.profileHandle, "nova");
  });

  test("the crew role wins, with the tagline standing in when it is empty", () => {
    const withRole = resolveCrewDisplay({
      ...row,
      role: "Founder",
      artistProfile: profile,
    });
    assert.equal(withRole.role, "Founder");
    assert.equal(withRole.roleFromTagline, false);

    const withoutRole = resolveCrewDisplay({ ...row, artistProfile: profile });
    assert.equal(withoutRole.role, "DJ / Producer");
    assert.equal(withoutRole.roleFromTagline, true);
  });

  test("a manual row shows its own values", () => {
    const display = resolveCrewDisplay(row);
    assert.equal(display.source, "manual");
    assert.equal(display.name, "Row name");
    assert.equal(display.image, "/crew_pfp/row.jpg");
    assert.equal(display.profileHandle, null);
  });
});
