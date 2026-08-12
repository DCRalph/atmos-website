import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import type { BetterAuthClientPlugin } from "better-auth/client";

import { API_URL, APP_SCHEME } from "./env";

/**
 * The same better-auth server the website uses.
 *
 * React Native has no `document.cookie`, so the Expo plugin keeps a virtual
 * cookie jar in SecureStore and replays it on every request. That storage is
 * also what lets a cold start render a signed-in UI without waiting on the
 * network.
 */

/*
 * The cast is upstream's, not ours: `expoClient` declares `getActions` with a
 * narrower `BetterFetch` than `BetterAuthClientPlugin` expects, and the two
 * generic signatures do not unify. Runtime is unaffected — the plugin is
 * exactly what better-auth expects — so this is pinned to the one line that is
 * actually wrong rather than loosening the client's types everywhere.
 */
const expoPlugin = expoClient({
  scheme: APP_SCHEME,
  storagePrefix: "atmos",
  storage: SecureStore,
}) as unknown as BetterAuthClientPlugin;

export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [expoPlugin],
});

export const { useSession, signIn, signUp, signOut } = authClient;

/** The signed-in user, as the app cares about them. */
export type AppUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
};

/**
 * Session, with a shape the screens can rely on.
 *
 * The plugin cast above costs better-auth its session inference, which would
 * otherwise surface as `never` at every call site. Restating the shape once,
 * here, keeps that entirely inside this file — screens get a plain typed user
 * and never touch the library's generics.
 */
export function useAuth(): {
  user: AppUser | null;
  isPending: boolean;
} {
  const session = useSession() as unknown as {
    data: { user: AppUser } | null;
    isPending: boolean;
  };
  return { user: session.data?.user ?? null, isPending: session.isPending };
}

/**
 * Cookie header for anything that bypasses the auth client.
 *
 * tRPC talks to the API directly rather than through better-auth's fetch, so it
 * has to attach the jar itself or every request arrives signed out. `getCookie`
 * is contributed by the Expo plugin's actions, which the cast above stops the
 * client from inferring — hence the explicit shape.
 */
export function authCookieHeader(): string {
  const withCookie = authClient as unknown as {
    getCookie?: () => string;
  };
  return withCookie.getCookie?.() ?? "";
}
