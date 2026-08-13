import { useCallback, useEffect, useRef, useState } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/lib/api";
import { colors, radius, space, stroke } from "@/lib/theme";
import { Body, Button, Caption, Loading, Notice } from "@/components/ui";
import { DoorHeader } from "@/components/door/door-header";
import { CheckResult } from "@/components/door/check-result";

type Lookup =
  | { kind: "token"; token: string }
  | { kind: "ticketNumber"; ticketNumber: string };

/**
 * Checking a ticket without using it.
 *
 * Every other door tab ends in a decision. This one deliberately doesn't: it is
 * for the moment when somebody is arguing that they were never let in, or a
 * manager wants to know what happened to a ticket before anybody acts. Scanning
 * to find out is not an option — the scan itself would admit them, or burn the
 * ticket as a duplicate, on the way to the answer.
 *
 * Camera and typed number both land in the same place, because the two reasons
 * to open this tab are a code somebody is holding up and a number read off a
 * printout.
 */
export default function CheckScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const insets = useSafeAreaInsets();

  const [permission, requestPermission] = useCameraPermissions();
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [typed, setTyped] = useState("");
  /** Stops one code re-firing while the result sheet animates in. */
  const lastToken = useRef<string | null>(null);

  const summary = api.door.summary.useQuery(
    { eventId },
    { enabled: !!eventId, refetchInterval: 15_000 },
  );

  const check = api.door.checkTicket.useQuery(
    { eventId, lookup: lookup! },
    { enabled: lookup !== null, retry: false },
  );

  // Same three-way signal as a scan, so a check reads by feel in a dark room —
  // but nothing here changed any record.
  const verdict = check.data?.verdict;
  useEffect(() => {
    if (!verdict) return;
    void Haptics.notificationAsync(
      verdict === "OK"
        ? Haptics.NotificationFeedbackType.Success
        : verdict === "ALREADY_IN"
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Error,
    );
  }, [verdict]);

  const onScanned = useCallback(
    ({ data }: { data: string }) => {
      if (lookup !== null) return;
      if (lastToken.current === data) return;
      lastToken.current = data;
      setLookup({ kind: "token", token: data });
    },
    [lookup],
  );

  const dismiss = useCallback(() => {
    setLookup(null);
    setTyped("");
    lastToken.current = null;
  }, []);

  const waiting = lookup !== null && !check.data && !check.isError;

  if (!permission) return <Loading label="Checking camera" />;

  if (!permission.granted) {
    return (
      <View style={[styles.centre, { paddingTop: insets.top + space.xxl }]}>
        <Notice
          title="Camera access needed"
          detail="Checking a ticket by QR needs the camera. Nothing is recorded — frames are read on the phone and discarded."
          action={
            <Button onPress={() => void requestPermission()}>
              Allow camera
            </Button>
          }
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <DoorHeader eventId={eventId} summary={summary.data} active="check" />

      <View style={styles.viewfinder}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={lookup !== null ? undefined : onScanned}
        />
        <View pointerEvents="none" style={styles.reticle} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: space.lg, gap: space.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <Body soft style={{ textAlign: "center" }}>
          {waiting ? "Looking it up…" : "Point at the ticket QR"}
        </Body>

        <View style={styles.explain}>
          <Caption>
            Looks a ticket up and shows everything that has happened to it.
            Nobody is admitted and nothing is recorded.
          </Caption>
        </View>

        <View style={{ gap: space.xs }}>
          <Caption>Or type the ticket number</Caption>
          <TextInput
            value={typed}
            onChangeText={(text) => setTyped(text.toUpperCase())}
            placeholder="ATN-4F7K2X-03"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="characters"
            autoCorrect={false}
            style={styles.input}
          />
        </View>

        <Button
          onPress={() =>
            setLookup({ kind: "ticketNumber", ticketNumber: typed.trim() })
          }
          disabled={typed.trim().length < 3}
          loading={waiting}
        >
          Look it up
        </Button>
      </ScrollView>

      {/* A lookup that fails outright — offline, or a shift that ended
          mid-queue. Its own panel rather than a toast, so the camera stays
          paused until it has been read and dismissed. */}
      {check.isError && lookup !== null ? (
        <View style={styles.errorOverlay}>
          <Body style={{ color: colors.deny, fontWeight: "700" }}>
            Couldn&apos;t check that
          </Body>
          <Caption>{check.error.message}</Caption>
          <Button variant="outline" onPress={dismiss}>
            Back
          </Button>
        </View>
      ) : null}

      {check.data ? (
        <CheckResult check={check.data} onDismiss={dismiss} />
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, paddingHorizontal: space.lg },
  explain: {
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    height: 60,
    borderRadius: radius.md,
    borderWidth: stroke.hard,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
    color: colors.text,
    fontSize: 20,
    fontFamily: "Menlo",
    letterSpacing: 1,
  },
  viewfinder: {
    // Shorter than the scan tab's square: a check is a considered action with
    // reading below it, not a queue being worked through at speed.
    aspectRatio: 1.6,
    margin: space.lg,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  reticle: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
    borderRadius: radius.lg,
    margin: space.xl,
  },
  errorOverlay: {
    position: "absolute",
    left: space.lg,
    right: space.lg,
    bottom: space.xxl,
    padding: space.lg,
    gap: space.sm,
    borderWidth: stroke.hard,
    borderColor: colors.deny,
    backgroundColor: colors.surface,
  },
});
