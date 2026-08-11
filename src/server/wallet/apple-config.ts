import "server-only";

import { env } from "~/env";

/**
 * Apple Wallet configuration, kept separate from the pass builder so that
 * "should I show an Add to Apple Wallet button?" costs nothing — the email
 * path would otherwise pull in the signing library and its certificates.
 *
 * Certificates are supplied as base64-encoded PEM. Apple hands out a `.p12`;
 * see `.env.example` for the two `openssl` commands that split it into the
 * signer certificate and key this expects. Base64 is only there so the PEM
 * newlines survive being an environment variable.
 */

export type AppleWalletConfig = {
  passTypeIdentifier: string;
  teamIdentifier: string;
  signerCert: Buffer;
  signerKey: Buffer;
  signerKeyPassphrase: string;
  wwdr: Buffer;
};

export function isAppleWalletConfigured(): boolean {
  return Boolean(
    env.APPLE_PASS_TYPE_ID &&
      env.APPLE_TEAM_ID &&
      env.APPLE_PASS_CERT_PEM_BASE64 &&
      env.APPLE_PASS_KEY_PEM_BASE64 &&
      env.APPLE_WWDR_PEM_BASE64,
  );
}

export function getAppleWalletConfig(): AppleWalletConfig {
  if (!isAppleWalletConfigured()) {
    throw new Error(
      "Apple Wallet is not configured. Set APPLE_PASS_TYPE_ID, APPLE_TEAM_ID, APPLE_PASS_CERT_PEM_BASE64, APPLE_PASS_KEY_PEM_BASE64 and APPLE_WWDR_PEM_BASE64.",
    );
  }

  return {
    passTypeIdentifier: env.APPLE_PASS_TYPE_ID!,
    teamIdentifier: env.APPLE_TEAM_ID!,
    signerCert: Buffer.from(env.APPLE_PASS_CERT_PEM_BASE64!, "base64"),
    signerKey: Buffer.from(env.APPLE_PASS_KEY_PEM_BASE64!, "base64"),
    signerKeyPassphrase: env.APPLE_PASS_KEY_PASSWORD ?? "",
    wwdr: Buffer.from(env.APPLE_WWDR_PEM_BASE64!, "base64"),
  };
}

/**
 * The signing certificate expires annually and an expired one means nobody can
 * add a pass. Returns days remaining, or null if it can't be read.
 */
export function appleCertDaysRemaining(): number | null {
  if (!env.APPLE_PASS_CERT_PEM_BASE64) return null;

  try {
    const pem = Buffer.from(env.APPLE_PASS_CERT_PEM_BASE64, "base64").toString(
      "utf8",
    );
    const match = /-----BEGIN CERTIFICATE-----([\s\S]+?)-----END CERTIFICATE-----/.exec(
      pem,
    );
    if (!match?.[1]) return null;

    const der = Buffer.from(match[1].replace(/\s+/g, ""), "base64");
    // `notAfter` is a UTCTime inside the validity SEQUENCE. Rather than write
    // an ASN.1 parser, find the two UTCTime tags (0x17, length 13) that every
    // Apple-issued cert uses and take the second.
    const times: string[] = [];
    for (let i = 0; i < der.length - 15; i++) {
      if (der[i] === 0x17 && der[i + 1] === 13) {
        times.push(der.subarray(i + 2, i + 15).toString("ascii"));
        if (times.length === 2) break;
      }
    }
    const notAfter = times[1];
    if (!notAfter) return null;

    // YYMMDDHHMMSSZ — the RFC 5280 rule is that 50-99 means 19xx.
    const yy = Number(notAfter.slice(0, 2));
    const year = yy >= 50 ? 1900 + yy : 2000 + yy;
    const expiry = Date.UTC(
      year,
      Number(notAfter.slice(2, 4)) - 1,
      Number(notAfter.slice(4, 6)),
      Number(notAfter.slice(6, 8)),
      Number(notAfter.slice(8, 10)),
      Number(notAfter.slice(10, 12)),
    );

    return Math.floor((expiry - Date.now()) / (24 * 60 * 60 * 1000));
  } catch {
    return null;
  }
}
