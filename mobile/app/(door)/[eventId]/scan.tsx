import { useCallback, useRef, useState } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/lib/api";
import { colors, radius, space } from "@/lib/theme";
import { Body, Button, Caption, Loading, Notice } from "@/components/ui";
import { ScanResult, type ScanOutcome } from "@/components/door/scan-result";
import { DoorHeader } from "@/components/door/door-header";
import { RecentScans } from "@/components/door/recent-scans";

/**
 * The scanner.
 *
 * The camera is paused whenever a result is on screen or a scan is in flight —
 * without that, a second code drifting into frame queues an admission nobody
 * asked for while staff are still reading the first answer.
 */
export default function ScanScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [permission, requestPermission] = useCameraPermissions();
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  /** Guards against the same code firing repeatedly while the sheet animates. */
  const lastToken = useRef<string | null>(null);

  const summary = api.door.summary.useQuery({ eventId }, { enabled: !!eventId });
  const utils = api.useUtils();

  const scan = api.door.scan.useMutation({
    onSuccess: async (result) => {
      setOutcome(result as ScanOutcome);
      await Haptics.notificationAsync(
        result.admit
          ? Haptics.NotificationFeedbackType.Success
          : result.result === "DUPLICATE"
            ? Haptics.NotificationFeedbackType.Warning
            : Haptics.NotificationFeedbackType.Error,
      );
      void summary.refetch();
      void utils.door.doorList.invalidate();
      void utils.door.orderTickets.invalidate();
    },
    onError: async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      lastToken.current = null;
    },
  });

  const onScanned = useCallback(
    ({ data }: { data: string }) => {
      if (outcome || scan.isPending) return;
      if (lastToken.current === data) return;
      lastToken.current = data;
      scan.mutate({ eventId, token: data });
    },
    [eventId, outcome, scan],
  );

  const dismiss = useCallback(() => {
    setOutcome(null);
    lastToken.current = null;
  }, []);

  if (!permission) return <Loading label="Checking camera" />;

  if (!permission.granted) {
    return (
      <View style={[styles.centre, { paddingTop: insets.top + space.xxl }]}>
        <Notice
          title="Camera access needed"
          detail="Scanning tickets needs the camera. Nothing is recorded — frames are read on the phone and discarded."
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
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <DoorHeader
        eventId={eventId}
        summary={summary.data}
        active="scan"
        onBack={() => router.replace("/(door)")}
      />

      <View style={styles.viewfinder}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={outcome || scan.isPending ? undefined : onScanned}
        />
        <View pointerEvents="none" style={styles.reticle} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: space.lg, gap: space.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: space.sm }}>
          <Body soft style={{ textAlign: "center" }}>
            {scan.isPending ? "Checking…" : "Point at the ticket QR"}
          </Body>
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/(door)/[eventId]/manual",
                params: { eventId },
              })
            }
            hitSlop={8}
          >
            <Caption style={{ textAlign: "center" }}>
              No phone? Enter a ticket number
            </Caption>
          </Pressable>
        </View>

        <RecentScans eventId={eventId} />
      </ScrollView>

      {outcome ? (
        <ScanResult
          eventId={eventId}
          outcome={outcome}
          isManager={summary.data?.isManager ?? false}
          onDismiss={dismiss}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, paddingHorizontal: space.lg },
  viewfinder: {
    // Square and fixed rather than flex: the camera stays put while the
    // recent-scans list scrolls under it, so the framing a staffer has learned
    // does not move when the list grows.
    aspectRatio: 1,
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
});
