import { requireOptionalNativeModule } from "expo-modules-core";

/**
 * Reading an ID document on this handset.
 *
 * The native side lives in `modules/text-recognition` — a local Expo module
 * rather than a patch to `ios/`, which `expo prebuild` regenerates and git
 * ignores. Nothing is imported from that folder here: autolinking registers it
 * under its `Name("TextRecognition")`, and looking it up by name keeps this
 * file free of a path into the native tree, exactly as `apple-education.ts`
 * does for the Tap to Pay module.
 *
 * Apple's Vision framework does the optical work, on the phone, for nothing.
 * The photograph of the card never leaves the device — what goes to the server
 * is a list of text lines and, when a face was found, a cropped portrait. The
 * server turns those lines into a name and a date of birth, because that
 * parsing has to stay identical to the web door's and has to be fixable
 * without an App Store release.
 *
 * ⚠️ This needs a fresh development build. A dev client installed before the
 * native module existed will report it unavailable, which is a real state the
 * door handles rather than a crash.
 */

type NativeLine = {
  text: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

type NativeTextRecognition = {
  isAvailable: () => boolean;
  readDocument: (uri: string) => Promise<{
    lines: NativeLine[];
    portrait: string | null;
  }>;
};

const native =
  requireOptionalNativeModule<NativeTextRecognition>("TextRecognition");

export type IdDocumentRead = {
  /** Recognised text, top to bottom, ready for the server's parser. */
  lines: string[];
  /** The cardholder's face as base64 JPEG, when one was found. */
  portrait: string | null;
};

/**
 * Whether this build can read a document at all.
 *
 * False on a dev client older than the native module, and false off iOS. The
 * door hides ID scanning rather than offering a button that cannot work.
 */
export function isIdReadingAvailable(): boolean {
  try {
    return native?.isAvailable() ?? false;
  } catch {
    return false;
  }
}

/**
 * Read a captured photo of a document.
 *
 * Returns null when nothing could be read — a dark frame, a thumb over the
 * card, or a build without the native module. The caller's response to all
 * three is the same (try again, or type it in), so they are not told apart.
 */
export async function readIdDocument(
  uri: string,
): Promise<IdDocumentRead | null> {
  if (!native) return null;

  try {
    const result = await native.readDocument(uri);
    const lines = result.lines
      // Vision scores every line it returns. Below a third it is guessing at
      // glare, and feeding that to the parser only gives it more ways to find
      // a date that was never printed.
      .filter((line) => line.confidence >= 0.3)
      .map((line) => line.text.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) return null;

    return { lines, portrait: result.portrait };
  } catch {
    return null;
  }
}
