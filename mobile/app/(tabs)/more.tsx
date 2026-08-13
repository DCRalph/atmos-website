import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronRight } from "lucide-react-native";

import { api } from "@/lib/api";
import { API_URL } from "@/lib/env";
import { signOut, useAuth } from "@/lib/auth";
import { useBiometrics } from "@/lib/biometrics";
import { getRegisteredPushToken } from "@/lib/push";
import { colors, radius, space, stroke } from "@/lib/theme";
import { Body, Button, Caption, Eyebrow, Title } from "@/components/ui";

/** Everything that does not earn a tab of its own. */
export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const biometrics = useBiometrics();
  const unregister = api.push.unregister.useMutation();

  // Door mode is staff tooling inside a customer app, so nothing about it
  // renders until someone is both signed in and actually rostered on. The
  // query is the same one the door itself uses and every door call re-checks
  // server-side — hiding the button is tidiness, not the security boundary.
  const myEvents = api.door.myEvents.useQuery(undefined, {
    enabled: !!user,
    // A refusal here is the normal answer for a punter, not an error worth
    // retrying three times.
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const isDoorStaff = !!user && (myEvents.data?.length ?? 0) > 0;

  // Same shape as the door check above, and the same reasoning: the query is
  // the one the organiser screens actually use, it is refused server-side for
  // everybody else, and hiding the button is tidiness rather than the boundary.
  const organiserEvents = api.ticketEvents.list.useQuery(
    { includeArchived: false },
    { enabled: !!user, retry: false, staleTime: 5 * 60 * 1000 },
  );
  const isOrganiser = !!user && organiserEvents.isSuccess;

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
            {isDoorStaff && (
              <Button
                variant="outline"
                size="sm"
                style={{ marginTop: space.md }}
                onPress={() => router.push("/(door)")}
              >
                Door mode
              </Button>
            )}
            {isOrganiser && (
              <Button
                variant="outline"
                size="sm"
                style={{ marginTop: space.sm }}
                onPress={() => router.push("/(admin)")}
              >
                Event analytics
              </Button>
            )}
            {/* Checklist 1.7. Hidden entirely when the handset has no
                biometric enrolled — a switch that cannot be turned on is worse
                than no switch. */}
            {biometrics.available && (
              <View style={styles.toggle}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Body>Unlock with {biometrics.label}</Body>
                  <Caption>
                    Locks the app when it has been put down. You stay signed in.
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
            <Button
              variant="outline"
              style={{ marginTop: space.md }}
              onPress={() => {
                // Drop the device registration first. A shared handset should
                // stop receiving notifications about this person's tickets the
                // moment they log out, not whenever it next launches.
                const token = getRegisteredPushToken();
                if (token) unregister.mutate({ token });
                void signOut();
              }}
            >
              Sign out
            </Button>
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
        Checklist 3.1 and 3.6 — Tap to Pay must be visible and discoverable
        outside checkout, and enabling it must be possible from settings. Also
        2.1: shown to everybody signed in, not just staff, because a new user
        has to be able to find out how Tap to Pay is reached at all. The screen
        itself tells a punter it is Atmos door tooling.
      */}
      {user ? (
        <View style={{ gap: space.sm }}>
          <Eyebrow>Payments</Eyebrow>
          <Row
            label="Tap to Pay on iPhone"
            onPress={() => router.push("/(door)/tap-to-pay")}
          />
        </View>
      ) : null}

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

function Row({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      <Body>{label}</Body>
      <ChevronRight color={colors.textFaint} size={16} strokeWidth={2.5} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    backgroundColor: colors.surface,
    borderWidth: stroke.hair,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: stroke.hair,
    borderTopColor: colors.border,
  },
});
