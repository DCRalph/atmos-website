import sanitizeHtml from "sanitize-html";
import { MAX_REPORT_BYTES, REPORT_BASE_CSS } from "~/lib/reports";

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ] ?? char,
  );

/** Keep reports self-contained and inert; only the admin wrapper provides navigation. */
export function reportDocument(title: string, html: string): string {
  if (Buffer.byteLength(html, "utf8") > MAX_REPORT_BYTES)
    throw new Error("Report exceeds the 1 MB limit.");
  const body = sanitizeHtml(html, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      "style",
      "img",
      "svg",
      "g",
      "defs",
      "linearGradient",
      "stop",
      "path",
      "rect",
      "circle",
      "ellipse",
      "line",
      "polyline",
      "polygon",
      "text",
      "tspan",
      "title",
      "desc",
    ],
    allowedAttributes: {
      "*": [
        "class",
        "id",
        "style",
        "title",
        "role",
        "aria-label",
        "aria-labelledby",
        "aria-describedby",
      ],
      th: ["scope", "colspan", "rowspan"],
      td: ["colspan", "rowspan"],
      img: ["src", "alt", "width", "height"],
      svg: ["viewBox", "width", "height", "fill", "xmlns"],
      g: ["transform", "fill", "stroke", "stroke-width", "opacity"],
      path: [
        "d",
        "fill",
        "stroke",
        "stroke-width",
        "stroke-linecap",
        "stroke-linejoin",
        "transform",
        "opacity",
      ],
      rect: ["x", "y", "width", "height", "rx", "ry", "fill", "opacity"],
      circle: ["cx", "cy", "r", "fill", "stroke", "stroke-width", "opacity"],
      ellipse: ["cx", "cy", "rx", "ry", "fill"],
      line: ["x1", "x2", "y1", "y2", "stroke", "stroke-width"],
      polyline: ["points", "fill", "stroke", "stroke-width"],
      polygon: ["points", "fill", "stroke", "stroke-width"],
      text: [
        "x",
        "y",
        "dx",
        "dy",
        "fill",
        "font-size",
        "font-weight",
        "text-anchor",
        "transform",
      ],
      tspan: ["x", "y", "dx", "dy"],
      linearGradient: ["x1", "x2", "y1", "y2"],
      stop: ["offset", "stop-color", "stop-opacity"],
    },
    allowedSchemes: ["data"],
    allowedSchemesByTag: { img: ["data"] },
    allowProtocolRelative: false,
    // CSS is confined to the sandbox. CSP blocks every external resource.
    allowVulnerableTags: true,
    parser: { lowerCaseTags: false, lowerCaseAttributeNames: false },
    transformTags: {
      img: (tagName, attribs) => {
        const src = attribs.src ?? "";
        return {
          tagName,
          attribs: {
            ...attribs,
            src: /^data:image\/(png|jpeg|webp|gif|avif);base64,/i.test(src)
              ? src
              : "",
          },
        };
      },
    },
  });
  if (!sanitizeHtml(body, { allowedTags: [], allowedAttributes: {} }).trim())
    throw new Error("Report contains no readable content.");
  const document = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${REPORT_BASE_CSS}</style></head><body>${body}</body></html>`;
  if (Buffer.byteLength(document, "utf8") > MAX_REPORT_BYTES)
    throw new Error("Report exceeds the 1 MB limit.");
  return document;
}
