import { useEffect, useRef } from "react";
import { Platform } from "react-native";
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
 * Module-level rather than state because sign-out needs it from a different
 * screen, and re-deriving it there would mean asking the OS again mid-logout.
 */
let currentToken: string | null = null;

export function getRegisteredPushToken(): string | null {
  return currentToken;
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

      currentToken = token;
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
  // where it is about rather than on the home screen.
  useEffect(() => {
    const subscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const url = response.notification.request.content.data?.url;
        if (typeof url === "string" && url.startsWith("/")) {
          router.push(url as never);
        }
      });
    return () => subscription.remove();
  }, [router]);
}
