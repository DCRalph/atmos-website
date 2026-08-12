import Constants from "expo-constants";

/**
 * Where the app talks to.
 *
 * In development this must be a LAN address, never `localhost` — that resolves
 * to the phone itself. The host Expo is already serving the bundle from is the
 * right guess, so it is read off the manifest and only falls back to an
 * explicit override or production.
 */
function devHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    // Older manifest shape, still present in some dev-client builds.
    (Constants.manifest2?.extra?.expoClient?.hostUri as string | undefined);

  if (!hostUri) return null;
  const host = hostUri.split(":")[0];
  if (!host) return null;
  return `http://${host}:3000`;
}

const OVERRIDE = process.env.EXPO_PUBLIC_API_URL;
/** Matches NEXT_PUBLIC_APP_URL on the server. */
const PRODUCTION = "https://atmosmedia.co.nz";

export const API_URL: string =
  OVERRIDE ?? (__DEV__ ? (devHost() ?? PRODUCTION) : PRODUCTION);

export const TRPC_URL = `${API_URL}/api/trpc`;

/** The scheme in app.config.ts — OAuth and ticket links come back to it. */
export const APP_SCHEME = "atmos";
