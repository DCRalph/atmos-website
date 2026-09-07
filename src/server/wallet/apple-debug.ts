import "server-only";

import { PKPass } from "passkit-generator";

import {
  walletPassDebugDraftSchema,
  type WalletPassDebugDraft,
} from "~/lib/ticketing/wallet-pass-debug";
import { getAppleWalletConfig } from "~/server/wallet/apple-config";
import { getPassImages } from "~/server/wallet/pass-images";

const MAX_MANIFEST_BYTES = 256_000;
const MAX_ASSET_BYTES = 2_000_000;
const MAX_TOTAL_ASSET_BYTES = 10_000_000;

function passStrings(translations: Record<string, string>): Buffer {
  const quote = (value: string) =>
    value
      .replaceAll("\\", "\\\\")
      .replaceAll('"', '\\"')
      .replaceAll("\r", "")
      .replaceAll("\n", "\\n");

  return Buffer.from(
    Object.entries(translations)
      .map(([key, value]) => `"${quote(key)}" = "${quote(value)}";`)
      .join("\n"),
    "utf8",
  );
}

/**
 * Signs one standalone pass. The draft contains the complete pass.json, so the
 * raw editor can reach every property supported by the installed PassKit
 * library while the friendly editor only needs to own common values.
 */
export async function buildStandaloneApplePass(
  input: WalletPassDebugDraft,
): Promise<Buffer> {
  const draft = walletPassDebugDraftSchema.parse(input);
  const manifest = Buffer.from(JSON.stringify(draft.manifest), "utf8");
  if (manifest.byteLength > MAX_MANIFEST_BYTES) {
    throw new Error("pass.json is larger than 256 KB.");
  }

  const artwork = await getPassImages(draft.theme);
  const files: Record<string, Buffer> = { ...artwork.files };
  let assetBytes = 0;

  for (const asset of draft.assets) {
    const buffer = Buffer.from(asset.dataBase64, "base64");
    if (buffer.byteLength > MAX_ASSET_BYTES) {
      throw new Error(`${asset.fileName} is larger than 2 MB.`);
    }
    assetBytes += buffer.byteLength;
    files[asset.fileName] = buffer;
  }

  if (assetBytes > MAX_TOTAL_ASSET_BYTES) {
    throw new Error("Pass assets are larger than 10 MB in total.");
  }

  for (const localization of draft.localizations) {
    files[`${localization.language}.lproj/pass.strings`] = passStrings(
      localization.translations,
    );
  }

  if (draft.personalization) {
    files["personalization.json"] = Buffer.from(
      JSON.stringify(draft.personalization),
      "utf8",
    );
  }

  files["pass.json"] = manifest;
  const config = getAppleWalletConfig();
  const pass = new PKPass(files, {
    wwdr: config.wwdr,
    signerCert: config.signerCert,
    signerKey: config.signerKey,
    signerKeyPassphrase: config.signerKeyPassphrase,
  });

  return pass.getAsBuffer();
}

export function standalonePassFilename(
  manifest: WalletPassDebugDraft["manifest"],
): string {
  const serial = manifest.serialNumber;
  const safeSerial =
    typeof serial === "string"
      ? serial.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 80)
      : "standalone";
  return `${safeSerial || "standalone"}.pkpass`;
}
