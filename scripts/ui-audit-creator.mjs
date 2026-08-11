#!/usr/bin/env node
/**
 * Visual audit of the creator profile editor and public profile page.
 *
 * Drives `/ui-test/creator` in headless Chromium at desktop and mobile widths,
 * screenshots every section, and measures each block's box against the actual
 * ink inside it. Blocks that reserve space they never fill — the "padding and
 * margins creating empty space" class of bug — come out as findings.
 *
 *   bun run ui:audit                 # all sections, both viewports
 *   bun run ui:audit -- --section=blocks-populated
 *   bun run ui:audit -- --viewport=mobile --outline
 *   bun run ui:audit -- --base-url=http://localhost:3001
 *
 * Output lands in `.ui-audit/` (screenshots + report.json + report.md).
 */
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { mkdir, writeFile, rm, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { MEASURE } from "./lib/measure-blocks.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, ".ui-audit");

/**
 * Fallback only — the real list is read off the harness index at run time, so
 * adding a section to `harness.tsx` is enough to get it audited.
 */
const FALLBACK_SECTIONS = [
  "final-page",
  "blocks-populated",
  "blocks-empty",
  "blocks-short",
  "blocks-tall",
  "blocks-narrow",
  "themes",
  "hero",
  "editor-grid",
  "editor-empty",
  "editor-inspector",
];

const VIEWPORTS = {
  desktop: { width: 1440, height: 1000 },
  mobile: { width: 390, height: 844 },
};

/** Sections that only exist on desktop (the editor tells you to use one). */
const DESKTOP_ONLY = new Set(["editor-grid", "editor-empty", "editor-inspector"]);

/** Blocks whose whole job is to be empty. */
const INTENTIONALLY_EMPTY = new Set(["SPACER"]);

/** Slack below this many px is just breathing room, not a bug. */
const SLACK_THRESHOLD_PX = 24;

// ---------------------------------------------------------------------------
// args
// ---------------------------------------------------------------------------

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);

const BASE_URL = (args["base-url"] ?? "http://localhost:3000").replace(/\/$/, "");
const WANTED_VIEWPORTS = args.viewport
  ? String(args.viewport).split(",")
  : Object.keys(VIEWPORTS);
const OUTLINE = Boolean(args.outline);

/** Ask the harness which sections it has, so the two never drift apart. */
async function discoverSections(page) {
  if (args.section) return String(args.section).split(",");
  try {
    await page.goto(`${BASE_URL}/ui-test/creator`, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    const ids = await page.$$eval("[data-uitest-section-id]", (els) =>
      els.map((e) => e.getAttribute("data-uitest-section-id")),
    );
    if (ids.length) return ids;
  } catch {
    // fall through
  }
  console.warn("• Could not read the section list from the harness; using the built-in list");
  return FALLBACK_SECTIONS;
}

// ---------------------------------------------------------------------------
// chromium discovery — reuse whatever browser is already on this machine
// ---------------------------------------------------------------------------

async function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;

  const cacheRoots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    path.join(os.homedir(), "Library/Caches/ms-playwright"),
    path.join(os.homedir(), ".cache/ms-playwright"),
    path.join(os.homedir(), "AppData/Local/ms-playwright"),
  ].filter(Boolean);

  for (const root of cacheRoots) {
    if (!existsSync(root)) continue;
    const entries = await readdir(root).catch(() => []);
    const dirs = entries
      .filter((e) => e.startsWith("chromium-"))
      .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
    for (const dir of dirs) {
      const candidates = [
        "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
        "chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
        "chrome-mac/Chromium.app/Contents/MacOS/Chromium",
        "chrome-linux/chrome",
        "chrome-win/chrome.exe",
      ].map((c) => path.join(root, dir, c));
      const hit = candidates.find((c) => existsSync(c));
      if (hit) return hit;
    }
  }

  const systemPaths = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ];
  const system = systemPaths.find((p) => existsSync(p));
  if (system) return system;

  throw new Error(
    "No Chromium found. Set CHROMIUM_PATH, or run `bunx playwright-core install chromium`.",
  );
}

// ---------------------------------------------------------------------------
// dev server
// ---------------------------------------------------------------------------

async function isUp(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (await isUp(BASE_URL)) {
    console.log(`• Using the dev server already running at ${BASE_URL}`);
    return null;
  }
  console.log(`• Starting \`next dev\` (nothing answering at ${BASE_URL})…`);
  const proc = spawn("bun", ["run", "dev"], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NODE_ENV: "development" },
  });
  proc.stdout.on("data", () => {});
  proc.stderr.on("data", () => {});

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (await isUp(BASE_URL)) {
      console.log("• Dev server up");
      return proc;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  proc.kill();
  throw new Error("Dev server did not come up within 120s");
}

// ---------------------------------------------------------------------------
// request interception — keeps the run offline and deterministic
// ---------------------------------------------------------------------------

function placeholderSvg(seed, label) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="hsl(${h},60%,45%)"/><stop offset="100%" stop-color="hsl(${(h + 60) % 360},60%,25%)"/>
</linearGradient></defs>
<rect width="800" height="600" fill="url(#g)"/>
<text x="400" y="310" font-family="monospace" font-size="34" fill="rgba(255,255,255,0.85)" text-anchor="middle">${label}</text>
</svg>`;
}

function stubEmbed(label) {
  return `<!doctype html><html style="height:100%"><body style="margin:0;height:100%;display:grid;place-items:center;background:#1b1b1f;color:#bbb;font:600 14px system-ui">${label} (stubbed)</body></html>`;
}

function firstLine(text) {
  return String(text).split("\n")[0].trim();
}

const EMBED_HOSTS = [
  [/(^|\.)soundcloud\.com$/, "SoundCloud"],
  [/(^|\.)spotify\.com$/, "Spotify"],
  [/(^|\.)youtube(-nocookie)?\.com$/, "YouTube"],
  [/(^|\.)ytimg\.com$/, "YouTube thumb"],
  [/(^|\.)example\.com$/, "Custom embed"],
];

const TELEMETRY_HOSTS = /(^|\.)(posthog\.com|i\.posthog\.com|vercel-insights\.com)$/;

/**
 * Match on the parsed URL, never on a substring of the whole thing.
 *
 * Turbopack names dev chunks after their module paths, so a loose pattern
 * like /posthog/ or /image/ silently swallows `/_next/static/chunks/...` and
 * the page never hydrates — which then reads as "every block is empty".
 */
async function installRoutes(context) {
  await context.route("**/*", (route) => {
    const request = route.request();
    let url;
    try {
      url = new URL(request.url());
    } catch {
      return route.continue();
    }
    const { hostname, pathname } = url;

    // Never touch the app's own JS/CSS.
    if (pathname.startsWith("/_next/static")) return route.continue();

    if (pathname.startsWith("/api/media/")) {
      const id = pathname.split("/").pop() ?? "image";
      return route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: placeholderSvg(id, id.slice(0, 24)),
      });
    }

    if (pathname === "/_next/image") {
      const source = url.searchParams.get("url") ?? "image";
      return route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: placeholderSvg(source, source.split("/").pop().slice(0, 24)),
      });
    }

    if (
      TELEMETRY_HOSTS.test(hostname) ||
      pathname.startsWith("/ph/") ||
      pathname.startsWith("/fuckoffaddblocker")
    ) {
      return route.abort();
    }

    const embed = EMBED_HOSTS.find(([pattern]) => pattern.test(hostname));
    if (embed) {
      const label = embed[1];
      if (request.resourceType() === "image") {
        return route.fulfill({
          status: 200,
          contentType: "image/svg+xml",
          body: placeholderSvg(label, label),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "text/html",
        body: stubEmbed(label),
      });
    }

    return route.continue();
  });
}

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

const MEASURE_ARGS = () => ({
  slackThreshold: SLACK_THRESHOLD_PX,
  intentionallyEmpty: [...INTENTIONALLY_EMPTY],
});

/**
 * Wait for the client-only content to land.
 *
 * Lexical renders an empty `contenteditable` on the server and fills it from
 * an effect after hydration, so a page that looks idle to the network can
 * still be missing every rich-text block. Measuring or screenshotting then
 * reports blocks as empty when they are not.
 */
/**
 * Scroll the whole page once. Every embed block is `loading="lazy"`, so
 * anything below the first screen stays blank in a full-page screenshot
 * unless it has been scrolled past at least once.
 */
async function scrollThroughPage(page) {
  await page.evaluate(async () => {
    const step = window.innerHeight;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 120));
  });
}

async function waitForHydration(page) {
  // Hard fail: an unhydrated page reports every block as empty, which would be
  // a screenful of fake findings.
  await page.waitForSelector('[data-uitest-root][data-hydrated="1"]', {
    timeout: 30_000,
  });

  await page
    .waitForFunction(
      () => {
        const editors = document.querySelectorAll("[data-lexical-editor]");
        if (editors.length === 0) return true; // nothing rich-text on this page
        return [...editors].every((e) => e.textContent.trim().length > 0);
      },
      null,
      { timeout: 20_000 },
    )
    .catch(() => {
      // Genuine when the fixture has no rich text (e.g. the empty-data pass).
      console.warn("\n    (rich text stayed empty — measuring anyway)");
    });
}

/**
 * Measure repeatedly until three consecutive passes agree, so a finding is
 * about layout rather than about when the screenshot happened to be taken.
 */
async function measureWhenSettled(page) {
  let previous = null;
  let agreements = 0;
  let result = null;
  for (let attempt = 0; attempt < 20; attempt++) {
    result = await page.evaluate(MEASURE, MEASURE_ARGS());
    const signature = JSON.stringify(
      result.blocks.map((b) => [b.type, b.boxHeight, b.inkHeight]),
    );
    agreements = previous === signature ? agreements + 1 : 0;
    if (agreements >= 2) return result;
    previous = signature;
    await page.waitForTimeout(250);
  }
  return result;
}

async function main() {
  const executablePath = await findChromium();
  console.log(`• Chromium: ${executablePath}`);

  const server = await ensureServer();
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ executablePath });
  const report = { baseUrl: BASE_URL, viewports: {}, findings: [] };

  try {
    for (const vpName of WANTED_VIEWPORTS) {
      const viewport = VIEWPORTS[vpName];
      if (!viewport) throw new Error(`Unknown viewport "${vpName}"`);

      const context = await browser.newContext({
        viewport,
        deviceScaleFactor: 1,
        colorScheme: "dark",
        reducedMotion: "reduce",
      });
      await installRoutes(context);
      const page = await context.newPage();
      let consoleErrors = [];
      page.on("console", (m) => {
        if (m.type() === "error") consoleErrors.push(m.text());
      });
      page.on("pageerror", (e) => consoleErrors.push(String(e)));

      await mkdir(path.join(OUT_DIR, vpName), { recursive: true });
      report.viewports[vpName] = { viewport, sections: {} };
      const allConsoleErrors = [];
      const sections = await discoverSections(page);

      for (const section of sections) {
        if (vpName === "mobile" && DESKTOP_ONLY.has(section)) continue;

        const url = `${BASE_URL}/ui-test/creator?section=${section}${
          OUTLINE ? "&outline=1" : ""
        }`;
        process.stdout.write(`  ${vpName}/${section} … `);

        consoleErrors = [];
        await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
        // The dev-tools bubble floats over the page and lands in screenshots.
        await page.addStyleTag({
          content: "nextjs-portal { display: none !important; }",
        });
        await page.evaluate(() => document.fonts.ready);
        await waitForHydration(page);
        await scrollThroughPage(page);
        const result = await measureWhenSettled(page);

        await page.screenshot({
          path: path.join(OUT_DIR, vpName, `${section}.png`),
          fullPage: true,
        });

        report.viewports[vpName].sections[section] = result;
        for (const f of result.findings) {
          report.findings.push({ viewport: vpName, section, ...f });
        }
        if (result.page.horizontalOverflow) {
          report.findings.push({
            viewport: vpName,
            section,
            kind: "page-overflow-x",
            id: `page/${section}`,
            detail: `page scrolls horizontally: ${result.page.scrollWidth}px content in a ${result.page.clientWidth}px viewport`,
          });
        }

        // A hydration mismatch throws the server's markup away and re-renders
        // client-side — flicker on the real site, so treat it as a finding.
        for (const err of new Set(consoleErrors)) {
          if (/Hydration failed|didn't match|hydration-mismatch/i.test(err)) {
            report.findings.push({
              viewport: vpName,
              section,
              kind: "hydration-mismatch",
              id: `page/${section}`,
              detail: firstLine(err),
            });
          }
        }
        allConsoleErrors.push(...consoleErrors);

        console.log(
          `${result.blocks.length} blocks, ${result.findings.length} findings`,
        );
      }

      report.viewports[vpName].consoleErrors = [
        ...new Set(allConsoleErrors.map(firstLine)),
      ].filter((e) => !/Failed to load resource/.test(e));
      await context.close();
    }
  } finally {
    await browser.close();
    if (server) server.kill();
  }

  await writeFile(
    path.join(OUT_DIR, "report.json"),
    JSON.stringify(report, null, 2),
  );
  const md = renderMarkdown(report);
  await writeFile(path.join(OUT_DIR, "report.md"), md);
  console.log("\n" + md);
  console.log(`\nScreenshots + report: ${path.relative(process.cwd(), OUT_DIR)}/`);
}

function renderMarkdown(report) {
  const lines = ["# Creator UI audit", ""];

  const byKind = {};
  for (const f of report.findings) (byKind[f.kind] ??= []).push(f);

  if (!report.findings.length) {
    lines.push("No layout findings. Every block fills the box it reserves.");
  }

  const order = [
    "hydration-mismatch",
    "empty-block",
    "dead-space",
    "overflow",
    "overflow-x",
    "page-overflow-x",
  ];
  for (const kind of order) {
    const list = byKind[kind];
    if (!list?.length) continue;
    lines.push(`## ${kind} (${list.length})`, "");

    // One row per distinct block, noting where it shows up.
    const SEP = " ";
    const grouped = {};
    for (const f of list) {
      const key = `${f.id}${SEP}${f.detail}`;
      const where = `${f.viewport}/${f.section}`;
      const seen = (grouped[key] ??= []);
      if (!seen.includes(where)) seen.push(where);
    }
    lines.push("| block | problem | seen in |", "| --- | --- | --- |");
    for (const [key, where] of Object.entries(grouped)) {
      const [id, detail] = key.split(SEP);
      lines.push(`| \`${id}\` | ${detail} | ${where.join(", ")} |`);
    }
    lines.push("");
  }

  for (const [vp, data] of Object.entries(report.viewports)) {
    // The two grids live in different sections, so compare across them.
    const publicGaps = new Set();
    const editorGaps = new Set();
    for (const s of Object.values(data.sections)) {
      if (s.gaps.public) publicGaps.add(s.gaps.public);
      if (s.gaps.editor) editorGaps.add(s.gaps.editor);
    }
    const mismatched = [...editorGaps].some((e) => !publicGaps.has(e));
    if (publicGaps.size && editorGaps.size && mismatched) {
      lines.push(
        `## grid gap mismatch (${vp})`,
        "",
        `Editor grid gap: ${[...editorGaps].join(", ")} — public grid gap: ${[...publicGaps].join(", ")}.`,
        "Blocks arranged in the editor land on a differently-spaced grid when published.",
        "",
      );
    }
    if (data.consoleErrors?.length) {
      lines.push(
        `## console errors (${vp})`,
        "",
        ...data.consoleErrors.slice(0, 20).map((e) => `- ${e}`),
        "",
      );
    }
  }

  return lines.join("\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
