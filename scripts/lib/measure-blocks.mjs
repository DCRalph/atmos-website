/**
 * Runs inside the page. Compares every block's reserved box against the union
 * of everything that actually paints inside it, and turns the difference into
 * findings. Kept in its own module so it can be exercised on its own.
 */
export const MEASURE = ({ slackThreshold, intentionallyEmpty }) => {
  const REPLACED = new Set([
    "IMG", "IFRAME", "VIDEO", "CANVAS", "SVG", "INPUT", "TEXTAREA", "SELECT", "HR",
  ]);

  const isPainted = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    if (Number(cs.opacity) === 0) return false;
    if (REPLACED.has(el.tagName)) return true;
    if (cs.backgroundImage !== "none") return true;
    const bg = cs.backgroundColor;
    if (bg && !/rgba?\([^)]*,\s*0\s*\)/.test(bg) && bg !== "transparent") return true;
    for (const side of ["Top", "Right", "Bottom", "Left"]) {
      if (
        parseFloat(cs[`border${side}Width`]) > 0 &&
        cs[`border${side}Style`] !== "none" &&
        !/rgba?\([^)]*,\s*0\s*\)/.test(cs[`border${side}Color`])
      ) {
        return true;
      }
    }
    // Direct, non-whitespace text.
    for (const node of el.childNodes) {
      if (node.nodeType === 3 && node.textContent.trim()) return true;
    }
    return false;
  };

  /** Union of the rects of everything that visibly paints inside `root`. */
  const inkBounds = (root) => {
    let top = Infinity, bottom = -Infinity, left = Infinity, right = -Infinity;
    const visit = (el) => {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return;
      if (el !== root && isPainted(el)) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          top = Math.min(top, r.top);
          bottom = Math.max(bottom, r.bottom);
          left = Math.min(left, r.left);
          right = Math.max(right, r.right);
        }
      }
      for (const child of el.children) visit(child);
    };
    visit(root);
    if (bottom === -Infinity) return null;
    return { top, bottom, left, right };
  };

  const measureAll = (selector, typeAttr, sizeAttr, surface) =>
    [...document.querySelectorAll(selector)]
      .map((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return null; // responsive twin

        const cs = getComputedStyle(el);
        const padTop = parseFloat(cs.paddingTop);
        const padBottom = parseFloat(cs.paddingBottom);
        const padLeft = parseFloat(cs.paddingLeft);
        const padRight = parseFloat(cs.paddingRight);
        const bTop = parseFloat(cs.borderTopWidth);
        const bBottom = parseFloat(cs.borderBottomWidth);
        const bLeft = parseFloat(cs.borderLeftWidth);
        const bRight = parseFloat(cs.borderRightWidth);

        const inner = {
          top: rect.top + bTop + padTop,
          bottom: rect.bottom - bBottom - padBottom,
          left: rect.left + bLeft + padLeft,
          right: rect.right - bRight - padRight,
        };
        const innerHeight = inner.bottom - inner.top;
        const innerWidth = inner.right - inner.left;

        const ink = inkBounds(el);
        const type = el.getAttribute(typeAttr) ?? "?";

        const base = {
          surface,
          type,
          // Which theme/density variant this instance was rendered under, so a
          // finding names the case that produced it.
          variant:
            el.closest("[data-uitest-theme]")?.getAttribute("data-uitest-theme") ??
            null,
          size: el.getAttribute(sizeAttr) ?? "?",
          boxHeight: Math.round(rect.height),
          innerHeight: Math.round(innerHeight),
          innerWidth: Math.round(innerWidth),
          padding: `${padTop}/${padRight}/${padBottom}/${padLeft}`,
          clipped: el.scrollHeight > el.clientHeight + 1,
          clippedBy: Math.max(0, Math.round(el.scrollHeight - el.clientHeight)),
        };

        if (!ink) {
          return { ...base, empty: true, slackTop: 0, slackBottom: 0, inkHeight: 0, fill: 0 };
        }

        return {
          ...base,
          empty: false,
          inkHeight: Math.round(ink.bottom - ink.top),
          slackTop: Math.round(ink.top - inner.top),
          slackBottom: Math.round(inner.bottom - ink.bottom),
          slackRight: Math.round(inner.right - ink.right),
          overflowBottom: Math.round(ink.bottom - inner.bottom),
          overflowRight: Math.round(ink.right - inner.right),
          fill: innerHeight > 0
            ? Math.round(((ink.bottom - ink.top) / innerHeight) * 100)
            : 0,
        };
      })
      .filter(Boolean);

  const blocks = [
    ...measureAll(".creator-block", "data-block-type", "data-block-size", "public"),
    ...measureAll(
      "[data-editor-block-type]",
      "data-editor-block-type",
      "data-editor-block-size",
      "editor",
    ),
  ];

  const findings = [];
  for (const b of blocks) {
    const id = `${b.surface}/${b.type} ${b.size}${b.variant ? ` [${b.variant}]` : ""}`;
    if (b.empty) {
      if (!intentionallyEmpty.includes(b.type)) {
        findings.push({
          kind: "empty-block",
          id,
          ...b,
          detail: `reserves ${b.boxHeight}px but paints nothing`,
        });
      }
      continue;
    }
    const slack = Math.max(0, b.slackBottom) + Math.max(0, b.slackTop);
    if (slack > slackThreshold) {
      findings.push({
        kind: "dead-space",
        id,
        ...b,
        detail:
          `${slack}px unused inside a ${b.innerHeight}px content box ` +
          `(top ${b.slackTop}, bottom ${b.slackBottom}) — content fills ${b.fill}%`,
      });
    }
    if (b.overflowBottom > 1 || b.clipped) {
      findings.push({
        kind: "overflow",
        id,
        ...b,
        detail: b.clipped
          ? `content is ${b.clippedBy}px taller than the box and gets clipped`
          : `content spills ${b.overflowBottom}px past the padding box`,
      });
    }
    if (b.overflowRight > 1) {
      findings.push({
        kind: "overflow-x",
        id,
        ...b,
        detail: `content spills ${b.overflowRight}px past the right padding edge`,
      });
    }
  }

  const doc = document.documentElement;
  const page = {
    scrollWidth: doc.scrollWidth,
    clientWidth: doc.clientWidth,
    scrollHeight: doc.scrollHeight,
    horizontalOverflow: doc.scrollWidth > doc.clientWidth + 1,
  };

  // Gap parity: the editor hard-codes 16px, the public page uses the theme's
  // density gap. If they differ, what you arrange is not what ships.
  const firstVisible = (selector) =>
    [...document.querySelectorAll(selector)].find((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
  const publicGrid = firstVisible(".creator-block")?.parentElement;
  const editorGrid = firstVisible("[data-editor-block-type]")?.parentElement;
  const gaps = {
    public: publicGrid ? getComputedStyle(publicGrid).gap : null,
    editor: editorGrid ? getComputedStyle(editorGrid).gap : null,
  };

  return { blocks, findings, page, gaps };
};
