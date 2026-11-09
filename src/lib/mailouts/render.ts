/**
 * A mailout as an email: Lexical body into table-based HTML and plain text,
 * inside the Atmos layout.
 *
 * Pure, so the admin preview, the test send and the real send all draw the
 * same thing. Each person's unsubscribe link differs, so the output carries
 * `UNSUBSCRIBE_URL` where it goes and `personalise` fills it in per recipient.
 */

export const UNSUBSCRIBE_URL = "%%unsubscribe_url%%";

const BG = "#000000";
const TEXT = "#ffffff";
const BODY = "#d4d4d4";
const MUTED = "#8a8a8a";
const ACCENT = "#c6ff33";

export type MailoutContent = {
  subject: string;
  previewText?: string | null;
  heading?: string | null;
  /** Serialized Lexical state, as the editor stores it. */
  body?: unknown;
  /** Absolute URL of the image above the text. */
  imageUrl?: string | null;
  buttonLabel?: string | null;
  buttonUrl?: string | null;
};

export type RenderOptions = {
  /** The main site, e.g. `https://atmosmedia.co.nz`. Links to it get tagged. */
  siteUrl: string;
  /** Becomes `utm_campaign` on links to the site. */
  slug: string;
  /** The lists it is going to, named in the footer. */
  listNames: string[];
  /** Who we are and how to reach us, for the footer. */
  contactEmail: string;
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Only web, mail and phone links survive. Anything else (`javascript:`, a
 * typo with no scheme) is dropped to plain text rather than sent.
 */
export function safeUrl(raw: string): string | null {
  const value = raw.trim();
  if (/^(mailto|tel):/i.test(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

/** The registrable part of a host, for matching `www.` and subdomains. */
function baseHost(host: string) {
  return host.toLowerCase().replace(/^www\./, "");
}

/**
 * Tag a link to our own site with the mailout's UTM parameters, so a ticket
 * bought from it counts as the mailout's. Tags already on the link win, and
 * links elsewhere are left alone.
 */
export function tagLink(raw: string, { siteUrl, slug }: RenderOptions) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  const site = baseHost(new URL(siteUrl).hostname);
  const host = baseHost(url.hostname);
  if (host !== site && !host.endsWith(`.${site}`)) return raw;
  if (url.searchParams.has("utm_source")) return raw;
  url.searchParams.set("utm_source", "email");
  url.searchParams.set("utm_medium", "mailout");
  url.searchParams.set("utm_campaign", slug);
  return url.toString();
}

type Node = {
  type?: unknown;
  text?: unknown;
  format?: unknown;
  tag?: unknown;
  listType?: unknown;
  url?: unknown;
  children?: unknown;
};

const isNode = (value: unknown): value is Node =>
  typeof value === "object" && value !== null;

const childrenOf = (node: Node): Node[] =>
  Array.isArray(node.children) ? node.children.filter(isNode) : [];

/** Lexical's text format bits. */
const BOLD = 1;
const ITALIC = 2;
const STRIKE = 4;
const UNDERLINE = 8;
const CODE = 16;

const ALIGN = new Set(["left", "center", "right", "justify"]);

function align(node: Node) {
  return typeof node.format === "string" && ALIGN.has(node.format)
    ? `text-align:${node.format};`
    : "";
}

const HEADING_SIZE: Record<string, string> = {
  h1: "28px",
  h2: "22px",
  h3: "18px",
};

function linkUrl(node: Node, options: RenderOptions) {
  const url = typeof node.url === "string" ? safeUrl(node.url) : null;
  return url ? tagLink(url, options) : null;
}

function isLink(node: Node) {
  return (
    typeof node.type === "string" &&
    (node.type === "link" || node.type === "autolink" || "url" in node)
  );
}

function inlineHtml(node: Node, options: RenderOptions): string {
  if (node.type === "text" && typeof node.text === "string") {
    let html = escapeHtml(node.text);
    const format = typeof node.format === "number" ? node.format : 0;
    if (format & CODE) {
      html = `<code style="font-family:Menlo,Consolas,monospace;font-size:14px;">${html}</code>`;
    }
    if (format & BOLD) html = `<strong>${html}</strong>`;
    if (format & ITALIC) html = `<em>${html}</em>`;
    if (format & UNDERLINE) html = `<u>${html}</u>`;
    if (format & STRIKE) html = `<s>${html}</s>`;
    return html;
  }
  if (node.type === "linebreak") return "<br>";
  if (node.type === "tab") return "&emsp;";
  const inner = childrenOf(node)
    .map((child) => inlineHtml(child, options))
    .join("");
  if (isLink(node)) {
    const url = linkUrl(node, options);
    return url
      ? `<a href="${escapeHtml(url)}" style="color:${ACCENT};text-decoration:underline;">${inner}</a>`
      : inner;
  }
  return inner;
}

function blockHtml(node: Node, options: RenderOptions): string {
  const inner = () =>
    childrenOf(node)
      .map((child) => inlineHtml(child, options))
      .join("");
  switch (node.type) {
    case "paragraph": {
      const content = inner();
      return `<p style="margin:0 0 16px;${align(node)}">${content || "&nbsp;"}</p>`;
    }
    case "heading": {
      const tag =
        typeof node.tag === "string" && /^h[1-6]$/.test(node.tag)
          ? node.tag
          : "h2";
      const size = HEADING_SIZE[tag] ?? "16px";
      return `<${tag} style="margin:24px 0 12px;font-size:${size};line-height:1.25;font-weight:800;color:${TEXT};${align(node)}">${inner()}</${tag}>`;
    }
    case "quote":
      return `<blockquote style="margin:0 0 16px;padding:0 0 0 14px;border-left:3px solid ${ACCENT};color:${TEXT};">${inner()}</blockquote>`;
    case "list": {
      const tag = node.listType === "number" ? "ol" : "ul";
      const items = childrenOf(node)
        .map((item) => {
          // A nested list sits inside an item of its own.
          const parts = childrenOf(item)
            .map((child) =>
              child.type === "list"
                ? blockHtml(child, options)
                : inlineHtml(child, options),
            )
            .join("");
          return `<li style="margin:0 0 6px;">${parts}</li>`;
        })
        .join("");
      return `<${tag} style="margin:0 0 16px;padding:0 0 0 22px;">${items}</${tag}>`;
    }
    case "code":
      return `<pre style="margin:0 0 16px;padding:12px;background:#111;font-family:Menlo,Consolas,monospace;font-size:13px;white-space:pre-wrap;">${inner()}</pre>`;
    default:
      return childrenOf(node).length
        ? `<div style="margin:0 0 16px;">${inner()}</div>`
        : "";
  }
}

function inlineText(node: Node, options: RenderOptions): string {
  if (node.type === "text" && typeof node.text === "string") return node.text;
  if (node.type === "linebreak") return "\n";
  if (node.type === "tab") return "\t";
  const inner = childrenOf(node)
    .map((child) => inlineText(child, options))
    .join("");
  if (isLink(node)) {
    const url = linkUrl(node, options);
    return url && url !== inner ? `${inner} (${url})` : inner;
  }
  return inner;
}

function blockText(node: Node, options: RenderOptions): string {
  if (node.type === "list") {
    return childrenOf(node)
      .map((item, index) => {
        const marker = node.listType === "number" ? `${index + 1}.` : "-";
        const parts = childrenOf(item);
        const own = parts
          .filter((child) => child.type !== "list")
          .map((child) => inlineText(child, options))
          .join("");
        const nested = parts
          .filter((child) => child.type === "list")
          .map((child) => blockText(child, options).replace(/^/gm, "  "));
        return [`${marker} ${own}`, ...nested].join("\n");
      })
      .join("\n");
  }
  const text = inlineText(node, options);
  return node.type === "quote" ? text.replace(/^/gm, "> ") : text;
}

function rootChildren(body: unknown): Node[] {
  if (!isNode(body) || !("root" in body)) return [];
  const root = (body as { root: unknown }).root;
  return isNode(root) ? childrenOf(root) : [];
}

function footerLine(options: RenderOptions) {
  const lists = options.listNames.length
    ? options.listNames.join(", ")
    : "an Atmos mailing list";
  return `You're getting this because you're on ${lists}.`;
}

/**
 * The whole email, HTML and text, with `UNSUBSCRIBE_URL` where each person's
 * link goes.
 */
export function renderMailout(
  content: MailoutContent,
  options: RenderOptions,
): { html: string; text: string } {
  const blocks = rootChildren(content.body);
  const button =
    content.buttonLabel?.trim() && content.buttonUrl
      ? safeUrl(content.buttonUrl)
      : null;
  const buttonUrl = button ? tagLink(button, options) : null;
  const imageUrl = content.imageUrl ? safeUrl(content.imageUrl) : null;
  const linkUrl = imageUrl && buttonUrl ? buttonUrl : null;
  const heading = content.heading?.trim();
  const preview = content.previewText?.trim();

  const image = imageUrl
    ? `<tr><td style="padding:0 0 24px;">${linkUrl ? `<a href="${escapeHtml(linkUrl)}">` : ""}<img src="${escapeHtml(imageUrl)}" width="600" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0;">${linkUrl ? "</a>" : ""}</td></tr>`
    : "";

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>${escapeHtml(content.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${BG};color:${TEXT};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
${preview ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preview)}${"&#847;&zwnj;&nbsp;".repeat(60)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td style="padding:8px 0 24px;">
  <img src="${escapeHtml(options.siteUrl)}/email/atmos-logo.png" width="160" height="36" alt="ATMOS" style="display:block;width:160px;height:auto;border:0;">
</td></tr>
${image}
${heading ? `<tr><td style="padding:0 0 16px;font-size:30px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;color:${TEXT};">${escapeHtml(heading)}</td></tr>` : ""}
<tr><td style="font-size:16px;line-height:1.6;color:${BODY};">
${blocks.map((block) => blockHtml(block, options)).join("\n")}
</td></tr>
${buttonUrl ? `<tr><td style="padding:8px 0 16px;"><a href="${escapeHtml(buttonUrl)}" style="display:inline-block;padding:14px 22px;background:${ACCENT};color:#000;text-decoration:none;font-size:15px;font-weight:700;border-radius:999px;">${escapeHtml(content.buttonLabel?.trim() ?? "")}</a></td></tr>` : ""}
<tr><td style="padding:32px 0 8px;color:${MUTED};font-size:12px;line-height:1.7;border-top:1px solid #222;">
${escapeHtml(footerLine(options))}<br>
<a href="${UNSUBSCRIBE_URL}" style="color:${MUTED};text-decoration:underline;">Unsubscribe or choose what you get</a><br>
Atmos Media, New Zealand &middot; <a href="mailto:${escapeHtml(options.contactEmail)}" style="color:${MUTED};">${escapeHtml(options.contactEmail)}</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    heading,
    blocks
      .map((block) => blockText(block, options))
      .filter((block) => block.trim())
      .join("\n\n"),
    buttonUrl ? `${content.buttonLabel?.trim()}: ${buttonUrl}` : null,
    "--",
    footerLine(options),
    `Unsubscribe or choose what you get: ${UNSUBSCRIBE_URL}`,
    `Atmos Media, New Zealand. ${options.contactEmail}`,
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n\n");

  return { html, text };
}

/** Fill in one person's unsubscribe link. */
export function personalise(
  email: { html: string; text: string },
  unsubscribeUrl: string,
) {
  return {
    html: email.html.replaceAll(UNSUBSCRIBE_URL, escapeHtml(unsubscribeUrl)),
    text: email.text.replaceAll(UNSUBSCRIBE_URL, unsubscribeUrl),
  };
}
