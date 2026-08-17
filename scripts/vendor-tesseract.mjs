#!/usr/bin/env node
/**
 * Put the OCR engine where the web door can reach it.
 *
 * The door reads ID documents on the device rather than uploading them, which
 * on the web means Tesseract compiled to WebAssembly running in the page. Three
 * things have to be served from our own origin for that to work at a door:
 *
 *   worker.min.js            the worker tesseract.js spawns
 *   tesseract-core-*.wasm.js the engine, wasm and all, in one file
 *   eng.traineddata          the English language model
 *
 * They are **not** loaded from the project's CDN, which is what tesseract.js
 * does by default. A door with patchy signal on a venue's guest wifi should not
 * be depending on a third party being up, and a photograph of somebody's
 * licence should not be processed by code fetched from a host we do not
 * control.
 *
 * The first two are copied out of `node_modules`; the model is downloaded once
 * and cached. Everything lands in `public/tesseract/`, which is gitignored —
 * eight megabytes of binaries do not belong in the history when a copy and a
 * one-time download reproduce them exactly.
 *
 * Run automatically by `postinstall`. If the download cannot happen — offline,
 * or GitHub having a bad day — this exits cleanly with a warning rather than
 * failing the install. The web door treats a missing engine as a first-class
 * state and falls back to typing the details in.
 *
 *   node scripts/vendor-tesseract.mjs
 */
import { copyFile, mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "public", "tesseract");

/**
 * The SIMD build, and only the SIMD build.
 *
 * tesseract.js ships six variants and picks between them at runtime by feature
 * detection; vendoring all of them costs twenty-odd megabytes to serve a case
 * that no longer exists. WebAssembly SIMD has been in Safari since 16.4, Chrome
 * since 91 and Firefox since 89. The `-lstm` build drops the legacy engine we
 * never ask for, which is another megabyte gone.
 */
const COPIES = [
  ["tesseract.js/dist/worker.min.js", "worker.min.js"],
  [
    "tesseract.js-core/tesseract-core-simd-lstm.wasm.js",
    "tesseract-core-simd-lstm.wasm.js",
  ],
];

/** tessdata_fast: a tenth the size of the full model, and this is printed text. */
const MODEL_URL =
  "https://github.com/tesseract-ocr/tessdata_fast/raw/main/eng.traineddata";
const MODEL_FILE = "eng.traineddata";

async function exists(file) {
  try {
    const info = await stat(file);
    return info.size > 0;
  } catch {
    return false;
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  for (const [from, to] of COPIES) {
    const source = path.join(ROOT, "node_modules", from);
    if (!(await exists(source))) {
      console.warn(`[tesseract] missing ${from} — is tesseract.js installed?`);
      return;
    }
    await copyFile(source, path.join(OUT_DIR, to));
  }

  const model = path.join(OUT_DIR, MODEL_FILE);
  if (await exists(model)) {
    console.log("[tesseract] assets ready");
    return;
  }

  try {
    const response = await fetch(MODEL_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await writeFile(model, Buffer.from(await response.arrayBuffer()));
    console.log("[tesseract] assets ready (model downloaded)");
  } catch (cause) {
    // Deliberately not fatal. An install that fails because a language model
    // could not be fetched would block every other kind of work on this repo.
    console.warn(
      `[tesseract] could not download the language model (${String(cause)}).\n` +
        "           The web door will offer manual ID entry instead.\n" +
        "           Re-run `node scripts/vendor-tesseract.mjs` when back online.",
    );
  }
}

await main();
