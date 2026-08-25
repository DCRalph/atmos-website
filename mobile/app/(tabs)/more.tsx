import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronRight, Lock } from "lucide-react-native";

import { api } from "@/lib/api";
import { API_URL } from "@/lib/env";
import { signOut, useAuth } from "@/lib/auth";
import { useBiometrics, useBiometricGate } from "@/lib/biometrics";
import { clearRegisteredPushToken, getRegisteredPushToken } from "@/lib/push";
import { useStaff } from "@/lib/staff";
import { colors, radius, space, stroke } from "@/lib/theme";
import { Body, Button, Caption, Eyebrow, Title } from "@/components/ui";

/** Everything that does not earn a tab of its own. */
export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const biometrics = useBiometrics();
  const gate = useBiometricGate();
  const unregister = api.push.unregister.useMutation();

  // Nothing internal renders until the server has confirmed this account is
  // staff — see `useStaff`. `ready` matters as much as the answer: drawing the
  // section optimistically would flash "Internal" at a punter on every launch.
  const { isDoorStaff, isOrganiser, isStaff, ready: staffReady } = useStaff();

  // One number, so the way into the rooms can say whether it is worth opening.
  // Gated on `isStaff` rather than fired for everybody: a punter's More tab
  // should not be asking the server about gig rooms at all.
  const unread = api.gigChat.unreadTotal.useQuery(undefined, {
    enabled: staffReady && isStaff,
    retry: false,
    refetchInterval: 60_000,
  });

  const openWeb = (path: string) => {
    void WebBrowser.openBrowserAsync(`${API_URL}${path}`, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      controlsColor: colors.text,
      toolbarColor: colors.bg,
    });
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + space.lg,
        paddingBottom: space.xxl,
        paddingHorizontal: space.lg,
        gap: space.xl,
      }}
    >
      <Title>More</Title>

      <View style={{ gap: space.sm }}>
        <Eyebrow>Account</Eyebrow>
        {user ? (
          <View style={styles.account}>
            <Body style={{ fontWeight: "700" }}>{user.name}</Body>
            <Caption>{user.email}</Caption>
            {!user.emailVerified && (
              <Caption style={{ color: colors.warn, marginTop: space.xs }}>
                Email not verified — verify it to see tickets you bought before
                installing the app.
              </Caption>
            )}
            <Button
              variant="outline"
              style={{ marginTop: space.md }}
              onPress={() => {
                // Drop the device registration first. A shared handset should
                // stop receiving notifications about this person's tickets the
                // moment they log out, not whenever it next launches.
                const token = getRegisteredPushToken();
                if (token) unregister.mutate({ token });
                clearRegisteredPushToken();
                void signOut();
              }}
            >
              Sign out
            </Button>
            {/*
              App Store Guideline 5.1.1(v). Last on the card and worded
              plainly, rather than hidden behind a support email — which is the
              arrangement the guideline exists to ban.
            */}
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/settings/delete-account")}
              hitSlop={8}
              style={({ pressed }) => [
                { marginTop: space.md },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Caption style={{ color: colors.deny }}>Delete account</Caption>
            </Pressable>
          </View>
        ) : (
          <View style={styles.account}>
            <Body soft>Sign in to keep your tickets in the app.</Body>
            <Button
              style={{ marginTop: space.md }}
              onPress={() => router.push("/(auth)/sign-in")}
            >
              Sign in
            </Button>
          </View>
        )}
      </View>

      {/*
        Staff tooling, gathered.

        Collapsed behind a single row until Face ID opens it, rather than
        prompting on sight: this section sits in a scroll view somebody passes
        on the way to Terms, and throwing a scan at them for scrolling would be
        absurd. The tap is what asks.

        The lock here guards the way in, not the destinations. `(door)`,
        `(admin)` and `(staff)` keep their own `BiometricGate` so a deep link or
        a notification tap lands on the same challenge.
      */}
      {staffReady && isStaff ? (
        <View style={{ gap: space.sm }}>
          <Eyebrow>Internal</Eyebrow>
          {gate.guarded ? (
            <Pressable
              accessibilityRole="button"
              onPress={gate.prompt}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Body>Locked</Body>
                <Caption>
                  {gate.failed
                    ? `${biometrics.label} didn't unlock. Tap to try again, or use your device passcode.`
                    : `Tap to unlock with ${biometrics.label}.`}
                </Caption>
              </View>
              <Lock color={colors.textFaint} size={16} strokeWidth={2.5} />
            </Pressable>
          ) : (
            <>
              {isDoorStaff && (
                <Row label="Door mode" onPress={() => router.push("/(door)")} />
              )}
              {/* Above event analytics on purpose: on a gig night this is the
                  row anybody opening this section actually wants. */}
              <Row label="Run sheet" onPress={() => router.push("/run-sheet")} />
              {isOrganiser && (
                <Row
                  label="Event analytics"
                  onPress={() => router.push("/(admin)")}
                />
              )}
              {isOrganiser && (
                <Row
                  label="Gig rooms"
                  badge={unread.data ?? 0}
                  onPress={() => router.push("/(admin)/chat")}
                />
              )}
              {isOrganiser && (
                <Row
                  label="Notify team"
                  onPress={() => router.push("/(admin)/notify")}
                />
              )}
              <Row
                label="Tap to Pay guides"
                onPress={() => router.push("/(door)/tap-to-pay")}
              />
              {/* Checklist 1.7. Hidden entirely when the handset has no
                  biometric enrolled — a switch that cannot be turned on is
                  worse than no switch. */}
              {biometrics.available && (
                <View style={styles.toggleRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Body>Unlock with {biometrics.label}</Body>
                    <Caption>
                      Locks this section and everything in it. Your own tickets
                      stay open.
                    </Caption>
                  </View>
                  <Switch
                    value={biometrics.enabled}
                    onValueChange={(next) => {
                      void biometrics.setEnabled(next);
                    }}
                    trackColor={{ true: colors.text, false: colors.border }}
                    thumbColor={colors.bg}
                  />
                </View>
              )}
            </>
          )}
        </View>
      ) : null}

      {/*
        Notifications, above the Atmos links rather than buried under them: the
        listing tells people they can mute these at any time, so "at any time"
        has to be somewhere they will actually find it.
      */}
      <View style={{ gap: space.sm }}>
        <Eyebrow>Settings</Eyebrow>
        <Row
          label="Notifications"
          onPress={() => router.push("/settings/notifications")}
        />
      </View>

      <View style={{ gap: space.sm }}>
        <Eyebrow>Atmos</Eyebrow>
        <Row label="Content" onPress={() => openWeb("/content")} />
        <Row label="About" onPress={() => openWeb("/about")} />
        <Row label="Crew" onPress={() => openWeb("/crew")} />
        <Row label="Gear rental" onPress={() => openWeb("/equipment")} />
        <Row label="Merch" onPress={() => openWeb("/merch")} />
        <Row label="Contact" onPress={() => openWeb("/contact")} />
      </View>

      <View style={{ gap: space.sm }}>
        <Eyebrow>Legal</Eyebrow>
        <Row label="Terms" onPress={() => openWeb("/terms")} />
        <Row label="Privacy" onPress={() => openWeb("/privacy")} />
      </View>
    </ScrollView>
  );
}

function Row({
  label,
  badge,
  onPress,
}: {
  label: string;
  /** Drawn only when there is something to say. Zero is not news. */
  badge?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      <Body>{label}</Body>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
        <ChevronRight color={colors.textFaint} size={16} strokeWidth={2.5} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 19,
    alignItems: "center",
    backgroundColor: colors.text,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeText: { color: "#000", fontSize: 10.5, fontWeight: "900" },
  account: {
    backgroundColor: colors.surface,
    borderWidth: stroke.hair,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    backgroundColor: colors.surface,
    borderWidth: stroke.hair,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  toggleRow: {
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
