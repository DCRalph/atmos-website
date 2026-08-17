/**
 * Reading an ID document in the browser.
 *
 * The web half of what `mobile/src/lib/id-ocr.ts` does natively: the card is
 * recognised **in the page**, and the photograph is never uploaded. What
 * reaches the server is the text and, if staff tapped the face, a crop of it.
 *
 * Tesseract compiled to WebAssembly, served from our own origin — see
 * `scripts/vendor-tesseract.mjs` for why the engine is not pulled off the
 * project's CDN at a door. The worker is expensive to start (a few seconds the
 * first time, while eight megabytes come down and compile) and cheap to keep,
 * so exactly one is created per page and reused for the night.
 *
 * Be honest about what this is: Tesseract on a phone photo of a New Zealand
 * licence is materially worse than Apple's Vision framework on the same card.
 * It is here because the alternative on the web is nothing, and because the
 * parser it feeds is built to say "I am not sure" rather than to guess. The
 * manual-entry path is one tap away for a reason.
 */

/** Where `scripts/vendor-tesseract.mjs` puts the engine. */
const ASSETS = {
  workerPath: "/tesseract/worker.min.js",
  corePath: "/tesseract/tesseract-core-simd-lstm.wasm.js",
  langPath: "/tesseract",
} as const;

type TesseractWorker = {
  recognize: (image: unknown) => Promise<{ data: { text: string } }>;
  setParameters: (params: Record<string, string>) => Promise<unknown>;
  terminate: () => Promise<unknown>;
};

let workerPromise: Promise<TesseractWorker | null> | null = null;

/**
 * The one worker, started on first use.
 *
 * A failure is cached along with a success. Retrying a broken engine on every
 * capture would mean a door staffer tapping "read this ID" and waiting eight
 * seconds for the same nothing, when what they need is to be sent to the form.
 */
async function getWorker(): Promise<TesseractWorker | null> {
  workerPromise ??= (async () => {
    try {
      const { createWorker, OEM, PSM } = await import("tesseract.js");

      const worker = (await createWorker("eng", OEM.LSTM_ONLY, {
        ...ASSETS,
        // The vendored model is the raw `.traineddata`, not the gzipped one
        // the CDN serves.
        gzip: false,
      })) as unknown as TesseractWorker;

      await worker.setParameters({
        // A licence is scattered fields, not a paragraph. `SPARSE_TEXT` stops
        // Tesseract trying to join a surname to the address beside it.
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        // Everything an identity document prints, and nothing else. Without
        // this, the guilloche patterns behind the text come back as symbols
        // and the parser has more haystack to search.
        tessedit_char_whitelist:
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,-/'<",
      });

      return worker;
    } catch (cause) {
      console.error("[id-check] OCR engine unavailable", cause);
      return null;
    }
  })();

  return workerPromise;
}

/** Warm the engine up before anybody is standing there waiting for it. */
export function primeIdReader(): void {
  void getWorker();
}

/** Shut the worker down — the page is leaving, or the door is done. */
export async function releaseIdReader(): Promise<void> {
  const worker = await workerPromise;
  workerPromise = null;
  await worker?.terminate().catch(() => undefined);
}

/**
 * Read a captured frame.
 *
 * Returns the recognised lines, or null when the engine could not run or found
 * nothing worth sending. Both leave the caller in the same place — offer the
 * form — so they are not told apart.
 */
export async function readIdFromCanvas(
  canvas: HTMLCanvasElement,
): Promise<string[] | null> {
  const worker = await getWorker();
  if (!worker) return null;

  try {
    const { data } = await worker.recognize(prepare(canvas));
    const lines = data.text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 1);

    return lines.length > 0 ? lines : null;
  } catch (cause) {
    console.error("[id-check] OCR failed", cause);
    return null;
  }
}

/**
 * Grayscale and stretch the contrast before recognition.
 *
 * A phone camera pointed at laminated plastic under a doorway light produces a
 * low-contrast image with a bright specular patch across it, and Tesseract is
 * far more sensitive to that than a native recogniser. This is a cheap fix that
 * measurably changes how often the birthday comes back.
 */
function prepare(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;

  const context = canvas.getContext("2d");
  if (!context) return source;

  context.drawImage(source, 0, 0);

  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = image.data;

  let min = 255;
  let max = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    // Rec. 601 luma. Cheaper than a colour-space conversion and closer to how
    // the eye weights the channels than a flat average.
    const luma =
      pixels[index]! * 0.299 +
      pixels[index + 1]! * 0.587 +
      pixels[index + 2]! * 0.114;
    pixels[index] = luma;
    if (luma < min) min = luma;
    if (luma > max) max = luma;
  }

  const spread = max - min || 1;
  for (let index = 0; index < pixels.length; index += 4) {
    const stretched = ((pixels[index]! - min) / spread) * 255;
    pixels[index] = stretched;
    pixels[index + 1] = stretched;
    pixels[index + 2] = stretched;
  }

  context.putImageData(image, 0, 0);
  return canvas;
}

/**
 * Crop the cardholder's face out of a captured frame, as base64 JPEG.
 *
 * The browser has no face detector worth shipping, so the staffer taps the
 * photo on the card and that point becomes the centre of the crop. One tap,
 * and it keeps the whole document from ever being stored: everything outside
 * this box — the address, the licence number, the classes — is discarded here,
 * before anything is sent.
 *
 * `x` and `y` are fractions of the frame, so a caller can pass a click position
 * without knowing the canvas resolution.
 */
export function cropPortrait(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
): string | null {
  // An ID portrait is roughly a fifth of the card's width and taller than it
  // is wide. Generous, because a tight crop of a face is hard to compare with
  // the face in front of you.
  const width = canvas.width * 0.26;
  const height = width * 1.25;

  const left = clamp(canvas.width * x - width / 2, 0, canvas.width - width);
  const top = clamp(canvas.height * y - height / 2, 0, canvas.height - height);

  const out = document.createElement("canvas");
  const scale = Math.min(1, 480 / Math.max(width, height));
  out.width = Math.round(width * scale);
  out.height = Math.round(height * scale);

  const context = out.getContext("2d");
  if (!context) return null;

  context.drawImage(
    canvas,
    left,
    top,
    width,
    height,
    0,
    0,
    out.width,
    out.height,
  );

  const dataUri = out.toDataURL("image/jpeg", 0.7);
  const comma = dataUri.indexOf(",");
  return comma > 0 ? dataUri.slice(comma + 1) : null;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), Math.max(low, high));
}
