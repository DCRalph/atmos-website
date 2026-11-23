import { SITE_ACCENT } from "~/lib/site-constants";

/**
 * Same value as `SITE_URL`, read without going through `~/env`, whose
 * validation would make this file unimportable from plain `bun test`.
 */
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://atmosmedia.co.nz";

/**
 * The Atmos email look, shared by every template in `src/emails/`.
 *
 * Black page, the logo image, a big white heading, grey body copy, the site's
 * lime pill for the one thing to do, and a muted footer under a rule. Written
 * as tables with inline styles because that is what survives Outlook and
 * Gmail's clipping.
 *
 * Pure and free of `server-only`: the admin mailout preview renders emails in
 * the browser with the same code the real send uses.
 */

export const COLORS = {
  bg: "#000000",
  text: "#ffffff",
  body: "#d4d4d4",
  muted: "#999999",
  rule: "#222222",
  panel: "#0b0b0b",
  panelBorder: "#242424",
  strongBorder: "#333333",
  accent: SITE_ACCENT,
} as const;

/** What every template returns, ready to hand to `sendEmail`. */
export type RenderedEmail = { subject: string; html: string; text: string };

/** Escape user-supplied text before it goes into an HTML email body. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The whole document: logo, `body` rows, then the footer.
 *
 * `body` is `<tr>` rows (build them with `row`). `footer` is trusted HTML and
 * gets "Atmos Media, New Zealand" under it. `preview` is the inbox preview
 * line, hidden in the body.
 */
export function emailShell({
  title,
  body,
  footer = "",
  preview,
  siteUrl = SITE_URL,
}: {
  title: string;
  body: string;
  footer?: string;
  preview?: string | null;
  /** Where the logo is served from. The mailout preview passes its own. */
  siteUrl?: string;
}): string {
  const { bg, text, muted, rule } = COLORS;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${bg};color:${text};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
${preview ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preview)}${"&#847;&zwnj;&nbsp;".repeat(60)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td style="padding:8px 0 32px;">
  <img src="${escapeHtml(siteUrl)}/email/atmos-logo.png" width="120" height="27" alt="ATMOS" style="display:block;width:120px;height:auto;border:0;">
</td></tr>
${body}
<tr><td style="padding:24px 0 8px;color:${muted};font-size:12px;line-height:1.7;border-top:1px solid ${rule};">
${footer ? `${footer}<br>` : ""}Atmos Media, New Zealand
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** One body row. `gap` is the space under it. */
export function row(content: string, gap = 18): string {
  return `<tr><td style="padding:0 0 ${gap}px;">${content}</td></tr>`;
}

/** The big white heading. Takes plain text. */
export function heading(value: string): string {
  return `<div style="font-size:30px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;color:${COLORS.text};">${escapeHtml(value)}</div>`;
}

/** Body copy. Takes trusted HTML, so escape anything user-supplied first. */
export function paragraph(html: string, { muted = false } = {}): string {
  return `<div style="font-size:15px;line-height:1.7;color:${muted ? COLORS.muted : COLORS.body};">${html}</div>`;
}

/** A heading with a line of context under it, the opening of most emails. */
export function intro(title: string, lede?: string): string {
  return row(
    `${heading(title)}${lede ? `<div style="height:12px;line-height:12px;">&nbsp;</div>${paragraph(lede)}` : ""}`,
  );
}

/**
 * A rounded panel in the shape the ticket pages use: square top-left corner,
 * the rest rounded. Outlook on Windows ignores the rounding and draws it
 * square, which still reads fine.
 */
export function panel(
  content: string,
  {
    border = COLORS.panelBorder,
    align = "left",
  }: { border?: string; align?: "left" | "center" } = {},
): string {
  return `<div style="background:${COLORS.panel};border:1px solid ${border};border-radius:16px;border-top-left-radius:0;padding:18px 20px;text-align:${align};">${content}</div>`;
}

/** Small uppercase label, for the top of a panel. */
export function eyebrow(value: string, color: string = COLORS.muted): string {
  return `<div style="font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:${color};margin-bottom:10px;">${escapeHtml(value)}</div>`;
}

/** Label and value rows, for receipts, invoices and staff alerts. */
export function detailTable(rows: [label: string, value: string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows
    .map(
      ([label, value]) =>
        `<tr><td valign="top" style="padding:6px 12px 6px 0;color:${COLORS.muted};font-size:14px;white-space:nowrap;">${escapeHtml(label)}</td><td style="padding:6px 0;color:${COLORS.text};font-size:14px;text-align:right;">${escapeHtml(value)}</td></tr>`,
    )
    .join("")}</table>`;
}

/** The site's lime pill: the one thing the email wants done. */
export function pillButton(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 26px;background:${COLORS.accent};color:#000000;text-decoration:none;font-size:15px;font-weight:700;border-radius:999px;">${escapeHtml(label)}</a>`;
}

/** An outlined pill, for a second, quieter action. */
export function ghostButton(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 22px;border:1px solid ${COLORS.strongBorder};color:${COLORS.text};text-decoration:none;font-size:14px;font-weight:600;border-radius:999px;">${escapeHtml(label)}</a>`;
}

/** "Questions? support@…" for the footer, or nothing without an address. */
export function supportLine(email: string | null): string {
  return email
    ? `Questions? <a href="mailto:${escapeHtml(email)}" style="color:${COLORS.muted};">${escapeHtml(email)}</a>`
    : "";
}
