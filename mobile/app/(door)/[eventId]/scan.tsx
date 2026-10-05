import { useCallback, useRef, useState } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Flashlight,
  FlashlightOff,
  Keyboard,
  Search,
} from "lucide-react-native";

import { api } from "@/lib/api";
import { labelArg, useDeviceLabel } from "@/lib/device-label";
import { colors, radius, space, type } from "@/lib/theme";
import { Button, IconButton, Loading } from "@/components/ui";
import { Glass } from "@/components/glass";
import { ScanResult, type ScanOutcome } from "@/components/door/scan-result";
import { CameraNeeded } from "@/components/door/camera-needed";
import { RecentScans } from "@/components/door/recent-scans";

/**
 * The scanner.
 *
 * The camera is paused whenever a result is on screen or a scan is in flight —
 * without that, a second code drifting into frame queues an admission nobody
 * asked for while staff are still reading the first answer.
 *
 * Everything floats over the feed: the header, the last few scans, and the
 * ways round a code that will not read — type the number, find them on the
 * list, or light it with the torch.
 */
export default function ScanScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [permission, requestPermission] = useCameraPermissions();
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [torch, setTorch] = useState(false);
  /** Guards against the same code firing repeatedly while the sheet animates. */
  const lastToken = useRef<string | null>(null);

  const { deviceLabel } = useDeviceLabel();

  // Polled, like the web scanner: on a second door the headcount moves without
  // anything happening on this phone, and a stale number is one staff act on.
  const summary = api.door.summary.useQuery(
    { eventId },
    { enabled: !!eventId, refetchInterval: 15_000 },
  );
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
      scan.mutate({ eventId, token: data, deviceLabel: labelArg(deviceLabel) });
    },
    [eventId, outcome, scan, deviceLabel],
  );

  const dismiss = useCallback(() => {
    setOutcome(null);
    lastToken.current = null;
  }, []);

  /** Another door tab, the way the header's tabs switch: in place. */
  const switchTo = (mode: "manual" | "list") =>
    router.replace({
      pathname: `/(door)/[eventId]/${mode}`,
      params: { eventId },
    });

  if (!permission) return <Loading label="Checking camera" />;

  if (!permission.granted) {
    return (
      <CameraNeeded
        detail="Scanning tickets needs the camera. Nothing is recorded — frames are read on the phone and discarded."
        canAskAgain={permission.canAskAgain}
        onAllow={() => void requestPermission()}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {/* The camera is the whole screen; everything else floats over it,
          the door's header included. */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={outcome || scan.isPending ? undefined : onScanned}
        enableTorch={torch}
      />

      <View pointerEvents="none" style={styles.aim}>
        <View style={styles.reticle}>
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
        </View>
        <Text style={styles.hint}>
          {scan.isPending ? "Checking…" : "Point at the ticket QR"}
        </Text>
      </View>

      <View
        style={[styles.bottom, { paddingBottom: insets.bottom + space.sm }]}
      >
        <Glass dark style={styles.panel}>
          <RecentScans
            eventId={eventId}
            isManager={summary.data?.isManager ?? false}
          />
        </Glass>
        <View style={styles.actions}>
          <Button
            variant="glass"
            icon={Keyboard}
            style={{ flex: 1 }}
            onPress={() => switchTo("manual")}
          >
            Type number
          </Button>
          <IconButton
            label="Find on the list"
            icon={Search}
            size={46}
            onPress={() => switchTo("list")}
          />
          <IconButton
            label={torch ? "Torch off" : "Torch on"}
            icon={torch ? FlashlightOff : Flashlight}
            size={46}
            onPress={() => setTorch(!torch)}
          />
        </View>
      </View>

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

const CORNER = 36;

const styles = StyleSheet.create({
  aim: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 120,
  },
  // Square: it frames the image, and imagery never takes a radius.
  reticle: { width: 240, height: 240 },
  corner: {
    position: "absolute",
    width: CORNER,
    height: CORNER,
    borderColor: colors.accent,
  },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  hint: { ...type.label, fontSize: 11, color: colors.text, marginTop: space.lg },
  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.lg,
    gap: space.md,
  },
  // The site's panel shape: rounded, with one hard corner.
  panel: {
    padding: 6,
    borderRadius: radius.lg,
    borderBottomLeftRadius: 0,
  },
  actions: { flexDirection: "row", gap: space.sm },
});
