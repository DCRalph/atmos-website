import { useEffect, useSyncExternalStore } from "react";
import { Linking, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { useRouter } from "expo-router";

import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/**
 * Notifications shown while the app is open, too — a doors-open reminder that
 * only appears when you happen to be elsewhere is a reminder that misses the
 * person already looking at their ticket.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * The token this install registered.
 *
 * Module-level rather than component state because two screens need it from
 * outside the tree that registered it — sign-out, to drop the device, and the
 * notification settings screen, to read and write this handset's preferences.
 * Re-deriving it in either place would mean asking the OS again mid-flow.
 *
 * Published through `useSyncExternalStore` so a screen mounted before
 * registration finishes still updates when it does, rather than sitting on a
 * stale `null` until something else happens to re-render it.
 */
let currentToken: string | null = null;
const listeners = new Set<() => void>();

function setToken(next: string | null): void {
  if (currentToken === next) return;
  currentToken = next;
  for (const listener of listeners) listener();
}

export function getRegisteredPushToken(): string | null {
  return currentToken;
}

/** The registered token, as state. `null` until the OS hands one over. */
export function usePushToken(): string | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getRegisteredPushToken,
    getRegisteredPushToken,
  );
}

/** Ask, register, and route taps. Mounted once, from the root layout. */
export function usePushRegistration(): void {
  const router = useRouter();
  const { user } = useAuth();
  const register = api.push.register.useMutation();

  // Re-registers when the signed-in user changes, which is what moves a shared
  // handset's notifications from one account to the other.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      // A simulator has no push token to give, and asking for one throws.
      if (!Device.isDevice) return;

      const existing = await Notifications.getPermissionsAsync();
      let status = existing.status;

      if (status !== "granted") {
        // Only ask once; iOS never shows the system prompt a second time.
        if (!existing.canAskAgain) return;
        const asked = await Notifications.requestPermissionsAsync();
        status = asked.status;
      }
      if (status !== "granted" || cancelled) return;

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId;
      if (!projectId) return;

      const { data: token } = await Notifications.getExpoPushTokenAsync({
        projectId: String(projectId),
      });
      if (cancelled || !token) return;

      setToken(token);
      register.mutate({
        token,
        platform: Platform.OS === "ios" ? "ios" : "android",
        label: Device.deviceName ?? undefined,
      });
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // A notification carries the screen it belongs to, so tapping one lands
  // where it is about rather than on the home screen. A team notification
  // published through `/api/notify` can carry an ntfy `Click` instead, which is
  // an absolute URL — usually a page of the web admin — so that opens outside.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const url = response.notification.request.content.data?.url;
        if (typeof url !== "string") return;

        if (url.startsWith("/")) {
          router.push(url as never);
        } else if (url.startsWith("https://") || url.startsWith("http://")) {
          void Linking.openURL(url).catch(() => {
            // A bad Click should not take the app down on a tap.
          });
        }
      },
    );
    return () => subscription.remove();
  }, [router]);
}

/**
 * Forget this handset.
 *
 * Clears the local copy as well as telling the server, so a sign-out followed
 * by a sign-in as somebody else does not re-send the previous person's token.
 */
export function clearRegisteredPushToken(): void {
  setToken(null);
}
