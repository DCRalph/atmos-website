import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Linking, ScrollView, StyleSheet, Switch, View } from "react-native";

import { api } from "@/lib/api";
import { usePushToken } from "@/lib/push";
import { colors, radius, space, stroke } from "@/lib/theme";
import {
  Body,
  Button,
  Caption,
  Eyebrow,
  Header,
  Loading,
  Notice,
} from "@/components/ui";

/**
 * Notifications, per handset.
 *
 * The listing promises people can mute these at any time, and until this screen
 * existed the only way to was to turn Atmos off entirely in iOS Settings —
 * which is the blunt instrument, not the switch that was promised.
 *
 * Per device rather than per account, matching `DeviceToken`: somebody can mute
 * announcements on a work phone and keep them on their own, and somebody who
 * has never signed in still gets to choose.
 */
export default function NotificationSettingsScreen() {
  const router = useRouter();
  const token = usePushToken();

  // The OS-level answer, which sits above everything on this screen: with the
  // system permission off, no switch below it can do anything.
  const [granted, setGranted] = useState<boolean | null>(null);

  const readPermission = useCallback(async () => {
    if (!Device.isDevice) {
      setGranted(false);
      return;
    }
    const status = await Notifications.getPermissionsAsync();
    setGranted(status.granted);
  }, []);

  useEffect(() => {
    void readPermission();
  }, [readPermission]);

  const preferences = api.push.preferences.useQuery(
    { token: token ?? "" },
    { enabled: !!token },
  );

  const utils = api.useUtils();
  const save = api.push.setPreferences.useMutation({
    onSettled: () => {
      if (token) void utils.push.preferences.invalidate({ token });
    },
  });

  // Draw the switch where the tap put it, not where the server was a moment
  // ago: a toggle that springs back for the length of a round trip reads as
  // broken. Only while the write is in flight, though — a failed one has to
  // snap back to what the server actually holds, or the screen lies.
  const optimistic = save.isPending ? save.variables : undefined;
  const current = {
    gigAnnouncements:
      optimistic?.gigAnnouncements ??
      preferences.data?.gigAnnouncements ??
      true,
    doorReminders:
      optimistic?.doorReminders ?? preferences.data?.doorReminders ?? true,
  };

  const set = (patch: {
    gigAnnouncements?: boolean;
    doorReminders?: boolean;
  }) => {
    if (!token) return;
    save.mutate({ token, ...current, ...patch });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Notifications" onBack={() => router.back()} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: space.lg,
          paddingBottom: space.xxl,
          paddingHorizontal: space.lg,
          gap: space.lg,
        }}
      >
        {granted === false ? (
          <Notice
            title="Notifications are off"
            detail={
              Device.isDevice
                ? "Atmos can't send anything until you turn them on for it in iOS Settings."
                : "A simulator can't receive notifications. Try this on a real handset."
            }
            action={
              Device.isDevice ? (
                <Button
                  variant="outline"
                  onPress={() => void Linking.openSettings()}
                >
                  Open Settings
                </Button>
              ) : undefined
            }
          />
        ) : null}

        {granted === null || (granted && !token) ? <Loading /> : null}

        {granted && token ? (
          <View style={{ gap: space.sm }}>
            <Eyebrow>This phone</Eyebrow>

            <Toggle
              label="New dates"
              detail="When a show is announced. This is the one the app is for."
              value={current.gigAnnouncements}
              onChange={(gigAnnouncements) => set({ gigAnnouncements })}
            />

            <Toggle
              label="Doors open"
              detail="A reminder on the night, only for shows you hold a ticket to."
              value={current.doorReminders}
              onChange={(doorReminders) => set({ doorReminders })}
            />

            {save.isError ? (
              <Caption style={{ color: colors.deny }}>
                That didn&apos;t save. Check your connection and try again.
              </Caption>
            ) : null}

            <Caption style={{ marginTop: space.sm }}>
              These are for this handset. Signing in on another phone gives that
              one its own settings.
            </Caption>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Toggle({
  label,
  detail,
  value,
  onChange,
}: {
  label: string;
  detail: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Body>{label}</Body>
        <Caption>{detail}</Caption>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.text, false: colors.border }}
        thumbColor={colors.bg}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    backgroundColor: colors.surface,
    borderWidth: stroke.hair,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
});
