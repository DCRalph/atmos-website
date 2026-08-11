import "server-only";

import { env } from "~/env";

/**
 * Google Wallet configuration. The service account JSON is stored as a single
 * env var; only the client email and private key are actually needed to sign
 * the "save to wallet" JWT.
 */

export type GoogleWalletConfig = {
  issuerId: string;
  clientEmail: string;
  privateKey: string;
};

let cached: GoogleWalletConfig | null | undefined;

function parseConfig(): GoogleWalletConfig | null {
  if (!env.GOOGLE_WALLET_ISSUER_ID || !env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON) {
    return null;
  }

  try {
    const parsed = JSON.parse(env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON) as {
      client_email?: string;
      private_key?: string;
    };
    if (!parsed.client_email || !parsed.private_key) return null;

    return {
      issuerId: env.GOOGLE_WALLET_ISSUER_ID,
      clientEmail: parsed.client_email,
      // Env vars flatten newlines; the PEM parser needs them back.
      privateKey: parsed.private_key.replace(/\\n/g, "\n"),
    };
  } catch {
    console.error(
      "[wallet] GOOGLE_WALLET_SERVICE_ACCOUNT_JSON is not valid JSON.",
    );
    return null;
  }
}

export function getGoogleWalletConfig(): GoogleWalletConfig | null {
  cached ??= parseConfig();
  return cached;
}

export function isGoogleWalletConfigured(): boolean {
  return getGoogleWalletConfig() !== null;
}
