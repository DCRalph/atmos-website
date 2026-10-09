import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  Animated,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { ArrowUpRight, ChevronRight, Lock } from "lucide-react-native";

import { api } from "@/lib/api";
import { API_URL } from "@/lib/env";
import { signOut, useAuth } from "@/lib/auth";
import { useBiometrics, useBiometricGate } from "@/lib/biometrics";
import { clearRegisteredPushToken, getRegisteredPushToken } from "@/lib/push";
import { useStaff } from "@/lib/staff";
import { useLiveActivityTest } from "@/lib/live-activity";
import { colors, radius, space, type } from "@/lib/theme";
import { Body, Button, Caption, Display, Eyebrow } from "@/components/ui";
import {
  LargeTitle,
  PinnedHeader,
  useScrollHeader,
} from "@/components/screen-header";
import { useTabBarSpace } from "@/components/tab-bar";

/** Everything that does not earn a tab of its own. */
export default function MoreScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const biometrics = useBiometrics();
  const gate = useBiometricGate();
  const unregister = api.push.unregister.useMutation();
  const lockScreen = useLiveActivityTest();
  const tabSpace = useTabBarSpace();
  const { scrollY, scrollProps } = useScrollHeader();

  // Nothing internal renders until the server has confirmed this account is
  // staff — see `useStaff`. `ready` matters as much as the answer: drawing the
  // section optimistically would flash "Internal" at a punter on every launch.
  const { isOrganiser, isStaff, isAdmin, ready: staffReady } = useStaff();

  // One number, so the way into the rooms can say whether it is worth opening.
  // Gated on `isStaff` rather than fired for everybody: a punter's More tab
  // should not be asking the server about gig rooms at all.
  const taskCount = api.tasks.alertCount.useQuery(undefined, {
    enabled: staffReady && isAdmin,
    retry: false,
    refetchInterval: 60_000,
  });
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
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Animated.ScrollView
        {...scrollProps}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: tabSpace }}
      >
        <LargeTitle>More</LargeTitle>
        <View style={styles.body}>
          <View>
            {user ? (
              <View style={styles.account}>
                <View style={styles.accountRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarLabel}>
                      {(user.name || user.email).slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Display size={20} keepCase numberOfLines={1}>
                      {user.name || "Signed in"}
                    </Display>
                    <Caption
                      numberOfLines={1}
                      style={{ marginTop: 6, color: colors.textSoft }}
                    >
                      {user.email}
                    </Caption>
                  </View>
                </View>
                {!user.emailVerified && (
                  <Caption style={{ color: colors.warn, marginTop: space.md }}>
                    Email not verified — verify it to see tickets you bought
                    before installing the app.
                  </Caption>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  style={{ marginTop: space.lg }}
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
                  <Text style={styles.danger}>Delete account</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.account}>
                <Body soft>Sign in to keep your tickets in the app.</Body>
                <Button
                  style={{ marginTop: space.lg, alignSelf: "flex-start" }}
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
            <View>
              <Eyebrow style={styles.sectionLabel}>Staff</Eyebrow>
              {gate.guarded ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={gate.prompt}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && { opacity: 0.7 },
                  ]}
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
                  {/* For all staff, not just tonight's roster: the picker inside
                    says "you're not on the door" better than a missing row
                    does, and the server refuses scans regardless. */}
                  <Row
                    label="Door mode"
                    onPress={() => router.push("/(door)")}
                  />
                  {/* Above event analytics on purpose: on a gig night this is the
                  row anybody opening this section actually wants. */}
                  <Row
                    label="Run sheet"
                    onPress={() => router.push("/run-sheet")}
                  />
                  {isAdmin && (
                    <Row
                      label="Tasks"
                      badge={taskCount.data?.overdue}
                      onPress={() => router.push("/tasks")}
                    />
                  )}
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
                  {/* A four minute fake night, for checking the widget renders at
                    all without waiting for a real one. Hidden where iOS cannot
                    show a Live Activity — a test that can only fail is not a
                    test — and from door staff, who have no use for a
                    diagnostic and should not meet a button called "Test". */}
                  {isOrganiser && lockScreen.supported && (
                    <Pressable
                      accessibilityRole="button"
                      onPress={
                        lockScreen.running ? lockScreen.stop : lockScreen.start
                      }
                      style={({ pressed }) => [
                        styles.row,
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Body>
                          {lockScreen.running
                            ? "Stop lock screen test"
                            : "Test lock screen"}
                        </Body>
                        <Caption>
                          {lockScreen.running
                            ? "A fake night, four minutes long. Lock the handset to watch it."
                            : "Puts a fake run sheet on the lock screen for four minutes."}
                        </Caption>
                      </View>
                    </Pressable>
                  )}
                  {/* Checklist 1.7. Hidden entirely when the handset has no
                  biometric enrolled — a switch that cannot be turned on is
                  worse than no switch. */}
                  {biometrics.available && (
                    <View style={styles.toggleRow}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Body>Unlock with {biometrics.label}</Body>
                        <Caption>
                          Locks this section and everything in it. Your own
                          tickets stay open.
                        </Caption>
                      </View>
                      <Switch
                        value={biometrics.enabled}
                        onValueChange={(next) => {
                          void biometrics.setEnabled(next);
                        }}
                        trackColor={{
                          true: colors.accent,
                          false: colors.borderStrong,
                        }}
                        thumbColor="#fff"
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
          <View>
            <Eyebrow style={styles.sectionLabel}>Settings</Eyebrow>
            <Row
              label="Notifications"
              onPress={() => router.push("/settings/notifications")}
            />
          </View>

          <View>
            <Eyebrow style={styles.sectionLabel}>Atmos</Eyebrow>
            <Row label="Content" web onPress={() => openWeb("/content")} />
            <Row label="About" web onPress={() => openWeb("/about")} />
            <Row label="Crew" web onPress={() => openWeb("/crew")} />
            <Row
              label="Gear rental"
              web
              onPress={() => openWeb("/equipment")}
            />
            <Row label="Merch" web onPress={() => openWeb("/merch")} />
            <Row label="Contact" web onPress={() => openWeb("/contact")} />
          </View>

          <View>
            <Eyebrow style={styles.sectionLabel}>Legal</Eyebrow>
            <Row label="Terms" web onPress={() => openWeb("/terms")} />
            <Row label="Privacy" web onPress={() => openWeb("/privacy")} />
          </View>
        </View>
      </Animated.ScrollView>

      <PinnedHeader scrollY={scrollY} title="More" />
    </View>
  );
}

function Row({
  label,
  badge,
  web,
  onPress,
}: {
  label: string;
  /** Drawn only when there is something to say. Zero is not news. */
  badge?: number;
  /** Opens the website rather than a screen of the app. */
  web?: boolean;
  onPress: () => void;
}) {
  const Arrow = web ? ArrowUpRight : ChevronRight;
  return (
    <Pressable
      accessibilityRole={web ? "link" : "button"}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: space.md }}
      >
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
        <Arrow color={colors.textFaint} size={16} strokeWidth={2} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.lg, paddingTop: space.xl, gap: space.xxl },
  account: {
    paddingBottom: space.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
  },
  accountRow: { flexDirection: "row", alignItems: "center", gap: space.lg },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLabel: { ...type.label, fontSize: 18, color: colors.text },
  danger: { ...type.label, fontSize: 11, color: colors.danger },
  sectionLabel: { marginBottom: space.xs },
  badge: {
    minWidth: 22,
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  badgeText: { ...type.label, fontSize: 10, color: colors.accentInk },
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: { ...type.label, fontSize: 12, color: colors.text, flexShrink: 1 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
