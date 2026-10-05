import { useState } from "react";
import * as Haptics from "expo-haptics";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LayoutAnimationConfig,
  LinearTransition,
} from "react-native-reanimated";

import { api } from "@/lib/api";
import { labelArg, useDeviceLabel } from "@/lib/device-label";
import { colors, radius, space, stroke, type } from "@/lib/theme";
import { formatGigTime } from "@/lib/dates";
import { denyReasonLabel } from "~/lib/ticketing/deny-reasons";
import { scanResultShort, scanResultTone } from "~/lib/ticketing/scan-results";
import { scanToneColor } from "@/lib/scan-tone";
import { Caption } from "@/components/ui";
import { PersonSheet } from "@/components/door/person-sheet";

/**
 * The last three scans, under the camera.
 *
 * Two jobs. It answers "did that go through?" without leaving the scanner, and
 * it is where a mistake gets fixed — a wrong tap is noticed within seconds, and
 * before this the only route back was to leave the camera, find the person in
 * the list, and open them.
 *
 * Only this staffer's own actions. At a door with three scanners the
 * event-wide feed is mostly other people's work, and the row you need to undo
 * is always one of yours. Everybody's is the Log tab.
 */
export function RecentScans({
  eventId,
  isManager,
}: {
  eventId: string;
  isManager: boolean;
}) {
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const { deviceLabel } = useDeviceLabel();
  const utils = api.useUtils();

  const scans = api.door.recentScans.useQuery(
    { eventId, limit: 3, mine: true },
    { enabled: !!eventId, refetchInterval: 10_000 },
  );

  const refresh = () => {
    void utils.door.recentScans.invalidate();
    void utils.door.summary.invalidate();
    void utils.door.doorList.invalidate();
    void utils.door.activity.invalidate();
  };

  const undoAdmission = api.door.revertAdmission.useMutation({
    onSuccess: async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      refresh();
    },
  });
  const undoDenial = api.door.revertDenial.useMutation({
    onSuccess: async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      refresh();
    },
  });

  const rows = scans.data ?? [];
  const busy = undoAdmission.isPending || undoDenial.isPending;

  return (
    // The rows already there when the scanner opens just appear; a scan taken
    // after that fades in at the top and pushes the older ones down.
    <LayoutAnimationConfig skipEntering>
      <View>
        {rows.length === 0 ? (
          <Caption style={styles.empty}>Your scans show here.</Caption>
        ) : (
          rows.map((scan) => {
            // Grouped by what it meant for the person holding the ticket, from
            // the same table the web feed reads — so a result added to the
            // enum gets a colour on both at once, rather than silently landing
            // in whichever branch a local ternary ended on.
            const dotColor = scanToneColor(scan.result);
            // An admission is the dot alone; anything else says what it was.
            const detail =
              scanResultTone(scan.result) === "in"
                ? scan.ticket?.tier?.name
                : [
                    scanResultShort(scan.result),
                    scan.denyReason ? denyReasonLabel(scan.denyReason) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ");
            return (
              <Animated.View
                key={scan.id}
                entering={FadeIn.duration(220)}
                exiting={FadeOut.duration(120)}
                layout={LinearTransition.duration(220)}
                style={styles.row}
              >
                <Pressable
                  disabled={!scan.ticketId}
                  onPress={() =>
                    scan.ticketId ? setOpenTicketId(scan.ticketId) : undefined
                  }
                  style={styles.rowMain}
                >
                  <View style={[styles.dot, { backgroundColor: dotColor }]} />
                  <Text numberOfLines={1} style={styles.name}>
                    {scan.ticket?.attendeeName ??
                      scan.ticket?.ticketNumber ??
                      "Unknown code"}
                    {detail ? (
                      <Text style={styles.detail}> · {detail}</Text>
                    ) : null}
                  </Text>
                  <Text style={styles.time}>
                    {formatGigTime(new Date(scan.createdAt))}
                  </Text>
                </Pressable>

                {/* Offered only while it still stands — the server decides, so
                  a row that has already been overtaken stops showing it. */}
                {scan.undo && scan.ticketId ? (
                  <Pressable
                    disabled={busy}
                    onPress={() =>
                      confirmUndo(
                        scan.undo!,
                        scan.ticket?.attendeeName ??
                          scan.ticket?.ticketNumber ??
                          "This ticket",
                        () =>
                          scan.undo === "admission"
                            ? undoAdmission.mutate({
                                eventId,
                                ticketId: scan.ticketId!,
                              })
                            : undoDenial.mutate({
                                eventId,
                                ticketId: scan.ticketId!,
                                deviceLabel: labelArg(deviceLabel),
                              }),
                      )
                    }
                    style={styles.undo}
                  >
                    <Text style={styles.undoLabel}>Undo</Text>
                  </Pressable>
                ) : null}
              </Animated.View>
            );
          })
        )}

        {openTicketId ? (
          <PersonSheet
            eventId={eventId}
            ticketId={openTicketId}
            isManager={isManager}
            onClose={() => setOpenTicketId(null)}
            onAdmit={() => setOpenTicketId(null)}
          />
        ) : null}
      </View>
    </LayoutAnimationConfig>
  );
}

/**
 * Ask before taking something back.
 *
 * A system alert rather than a second tap on the same button: this sits inches
 * from rows staff are skimming, and a stray double-tap would sail straight
 * through an inline "Sure?".
 *
 * The two cases are not equally serious, and the wording says so. Undoing an
 * admission moves the headcount and puts somebody back outside; taking back a
 * refusal only restores a choice, and the original still stands in the history.
 */
function confirmUndo(
  kind: "admission" | "denial",
  who: string,
  run: () => void,
): void {
  if (kind === "admission") {
    Alert.alert(
      "Undo admission?",
      `${who} goes back to not arrived, and the headcount drops by one.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Undo admission", style: "destructive", onPress: run },
      ],
    );
    return;
  }

  Alert.alert(
    "Take back refusal?",
    `${who} can be admitted again. The refusal stays in their history either way.`,
    [
      { text: "Cancel", style: "cancel" },
      { text: "Take it back", onPress: run },
    ],
  );
}

const styles = StyleSheet.create({
  empty: { paddingHorizontal: space.md, paddingVertical: space.md },
  row: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.md,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    alignSelf: "stretch",
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  name: { ...type.body, flex: 1, fontSize: 14, color: colors.text },
  detail: { color: colors.textFaint },
  time: {
    ...type.caption,
    fontSize: 12,
    color: colors.textFaint,
    fontVariant: ["tabular-nums"],
  },
  undo: {
    marginLeft: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: stroke.hair,
    borderColor: colors.borderHard,
  },
  undoLabel: { ...type.label, fontSize: 10, color: colors.text },
});
