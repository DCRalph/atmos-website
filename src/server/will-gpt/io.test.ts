import { describe, test } from "bun:test";
import assert from "node:assert/strict";
import { z } from "zod";

import { plainTextToLexical } from "~/lib/gig-import/lexical";
import { inputSchemaOf, prepareInput, toolOutput } from "./io";

const gigInput = z.object({
  title: z.string(),
  gigStartTime: z.date(),
  gigEndTime: z.date().nullish(),
  ticketLink: z.string().optional(),
  descriptionLexical: z
    .custom<object>((val) => typeof val === "object")
    .nullish(),
  sets: z.array(z.object({ startsAt: z.date() })).default([]),
});

describe("prepareInput", () => {
  test("reads ISO strings as Dates where the schema wants one, at any depth", () => {
    const input = prepareInput(gigInput, {
      title: "Atmos 004",
      gigStartTime: "2026-12-12T21:00:00+13:00",
      sets: [{ startsAt: "2026-12-12T22:00:00+13:00" }],
    });

    const parsed = gigInput.parse(input);
    assert.equal(parsed.gigStartTime.toISOString(), "2026-12-12T08:00:00.000Z");
    assert.equal(
      parsed.sets[0]?.startsAt.toISOString(),
      "2026-12-12T09:00:00.000Z",
    );
  });

  test("leaves strings the schema wants as strings", () => {
    const input = prepareInput(gigInput, {
      title: "2026-12-12T21:00:00+13:00",
      gigStartTime: "2026-12-12T21:00:00+13:00",
      ticketLink: "2026-12-12T21:00:00+13:00",
    });

    const parsed = gigInput.parse(input);
    assert.equal(parsed.title, "2026-12-12T21:00:00+13:00");
    assert.equal(parsed.ticketLink, "2026-12-12T21:00:00+13:00");
  });

  test("builds rich text from plain text, one paragraph per blank line", () => {
    const input = prepareInput(gigInput, {
      title: "Atmos 004",
      gigStartTime: "2026-12-12T21:00:00+13:00",
      descriptionLexical: "First paragraph.\n\nSecond paragraph.",
    });

    const parsed = gigInput.parse(input);
    assert.deepEqual(
      (parsed.descriptionLexical as { root: { children: unknown[] } }).root
        .children.length,
      2,
    );
  });
});

describe("inputSchemaOf", () => {
  test("presents dates as date-time strings", () => {
    assert.deepEqual(inputSchemaOf(z.object({ at: z.date() })), {
      type: "object",
      properties: { at: { type: "string", format: "date-time" } },
      required: ["at"],
    });
  });
});

describe("toolOutput", () => {
  test("returns rich text as the plain text it was written in", () => {
    const output = toolOutput([
      {
        title: "Atmos 004",
        descriptionLexical: plainTextToLexical("One.\n\nTwo."),
      },
    ]);
    assert.deepEqual(JSON.parse(output), [
      { title: "Atmos 004", descriptionLexical: "One.\n\nTwo." },
    ]);
  });

  test("keeps dates as dates", () => {
    const output = toolOutput({ at: new Date("2026-12-12T08:00:00.000Z") });
    assert.equal(output, '{"at":"2026-12-12T08:00:00.000Z"}');
  });

  test("cuts a long list at a whole item and says how much is missing", () => {
    const gigs = Array.from({ length: 100 }, (_, i) => ({
      id: `gig-${i}`,
      title: "x".repeat(50),
    }));
    const output = JSON.parse(toolOutput(gigs, 1_000)) as {
      items: unknown[];
      note: string;
    };
    assert.ok(output.items.length > 0 && output.items.length < 100);
    assert.match(output.note, new RegExp(`${output.items.length} of 100`));
  });
});
