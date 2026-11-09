import { describe, expect, test } from "bun:test";

import { extractEmails } from "./emails";
import {
  personalise,
  renderMailout,
  tagLink,
  UNSUBSCRIBE_URL,
  type RenderOptions,
} from "./render";
import {
  signUnsubscribeToken,
  verifyUnsubscribeToken,
} from "./unsubscribe-token";

const options: RenderOptions = {
  siteUrl: "https://atmosmedia.co.nz",
  slug: "vol-3-on-sale",
  listNames: ["Newsletter"],
  contactEmail: "admin@atmosmedia.co.nz",
};

const text = (value: string, format = 0) => ({
  type: "text",
  text: value,
  format,
});
const body = (...children: unknown[]) => ({ root: { type: "root", children } });

describe("tagLink", () => {
  test("tags links to the site and its subdomains", () => {
    expect(tagLink("https://www.atmosmedia.co.nz/events/vol-3", options)).toBe(
      "https://www.atmosmedia.co.nz/events/vol-3?utm_source=email&utm_medium=mailout&utm_campaign=vol-3-on-sale",
    );
    expect(tagLink("https://tickets.atmosmedia.co.nz/x", options)).toContain(
      "utm_campaign=vol-3-on-sale",
    );
  });

  test("leaves other sites and hand-tagged links alone", () => {
    expect(tagLink("https://instagram.com/atmos.nz", options)).toBe(
      "https://instagram.com/atmos.nz",
    );
    expect(tagLink("https://notatmosmedia.co.nz/", options)).toBe(
      "https://notatmosmedia.co.nz/",
    );
    const own = "https://atmosmedia.co.nz/?utm_source=ig";
    expect(tagLink(own, options)).toBe(own);
  });
});

describe("renderMailout", () => {
  const email = renderMailout(
    {
      subject: "Vol 3 <on sale>",
      previewText: "First release is cheapest",
      heading: "Vol 3",
      body: body(
        {
          type: "paragraph",
          children: [
            text("Tickets "),
            text("now", 1),
            text(" at "),
            {
              type: "link",
              url: "https://atmosmedia.co.nz/events/vol-3",
              children: [text("the page")],
            },
          ],
        },
        {
          type: "paragraph",
          children: [
            {
              type: "link",
              url: "javascript:alert(1)",
              children: [text("bad")],
            },
          ],
        },
        {
          type: "list",
          listType: "number",
          children: [
            { type: "listitem", children: [text("One")] },
            { type: "listitem", children: [text("Two")] },
          ],
        },
      ),
      buttonLabel: "Get tickets",
      buttonUrl: "https://atmosmedia.co.nz/events/vol-3",
    },
    options,
  );

  test("escapes, formats and tags links in the HTML", () => {
    expect(email.html).toContain("<title>Vol 3 &lt;on sale&gt;</title>");
    expect(email.html).toContain("<strong>now</strong>");
    expect(email.html).toContain(
      'href="https://atmosmedia.co.nz/events/vol-3?utm_source=email&amp;utm_medium=mailout&amp;utm_campaign=vol-3-on-sale"',
    );
    expect(email.html).toContain("First release is cheapest");
    expect(email.html).toContain("<ol");
  });

  test("drops links that are not web, mail or phone", () => {
    expect(email.html.includes("javascript:")).toBe(false);
    expect(email.html).toContain(">bad</p>");
  });

  test("writes a plain text version with links spelled out", () => {
    expect(email.text).toContain(
      "Tickets now at the page (https://atmosmedia.co.nz/events/vol-3?utm_source=email",
    );
    expect(email.text).toContain("1. One\n2. Two");
    expect(email.text).toContain("Get tickets: https://atmosmedia.co.nz");
    expect(email.text).toContain("you're on Newsletter");
  });

  test("leaves a placeholder for each person's unsubscribe link", () => {
    expect(email.html).toContain(UNSUBSCRIBE_URL);
    const mine = personalise(
      email,
      "https://atmosmedia.co.nz/unsubscribe/a.b.c",
    );
    expect(mine.html.includes(UNSUBSCRIBE_URL)).toBe(false);
    expect(mine.text).toContain("https://atmosmedia.co.nz/unsubscribe/a.b.c");
  });
});

describe("unsubscribe tokens", () => {
  test("round trip, with and without a mailout", () => {
    const token = signUnsubscribeToken("key", "sub1", "mail1");
    expect(verifyUnsubscribeToken("key", token)).toEqual({
      subscriberId: "sub1",
      mailoutId: "mail1",
    });
    expect(
      verifyUnsubscribeToken("key", signUnsubscribeToken("key", "sub1", null)),
    ).toEqual({ subscriberId: "sub1", mailoutId: null });
  });

  test("refuse an edited token or the wrong key", () => {
    const token = signUnsubscribeToken("key", "sub1", "mail1");
    expect(verifyUnsubscribeToken("key", token.replace("sub1", "sub2"))).toBe(
      null,
    );
    expect(verifyUnsubscribeToken("other", token)).toBe(null);
    expect(verifyUnsubscribeToken("key", "nonsense")).toBe(null);
  });
});

test("extractEmails reads a messy paste, once each", () => {
  expect(
    extractEmails(
      'email,name\nSam@Example.com,Sam\n"Jo" <jo@example.co.nz>; sam@example.com\nnot-an-email',
    ),
  ).toEqual(["sam@example.com", "jo@example.co.nz"]);
});
