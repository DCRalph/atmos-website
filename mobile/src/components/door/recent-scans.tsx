import { useState } from "react";
import * as Haptics from "expo-haptics";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "@/lib/api";
import { labelArg, useDeviceLabel } from "@/lib/device-label";
import { colors, radius, space, stroke } from "@/lib/theme";
import { formatTimeAgo } from "@/lib/dates";
import { denyReasonLabel } from "~/lib/ticketing/deny-reasons";
import { Body, Caption, Eyebrow } from "@/components/ui";
import { PersonSheet } from "@/components/door/person-sheet";

/** Scan results that mean the person got in. */
const ADMITTING = new Set(["ADMITTED", "OVERRIDE_ADMITTED", "REENTRY"]);

/** Plain wording, so a row reads without decoding an enum. */
const LABELS: Record<string, string> = {
  ADMITTED: "Admitted",
  REENTRY: "Re-entry",
  OVERRIDE_ADMITTED: "Let in anyway",
  DUPLICATE: "Already in",
  ADMISSION_REVERTED: "Admission undone",
  DENIAL_REVERTED: "Refusal taken back",
  NOTE: "Note",
  DENIED: "Refused",
  PREVIOUSLY_DENIED: "Scanned while refused",
  INVALID_SIGNATURE: "Code did not verify",
  NOT_FOUND: "Unknown code",
  WRONG_EVENT: "Another event",
  VOIDED: "Void ticket",
  REFUNDED_TICKET: "Refunded ticket",
  ORDER_UNPAID: "Order unpaid",
};

/**
 * The last few scans, under the camera.
 *
 * Two jobs. It answers "did that go through?" without leaving the scanner, and
 * it is where a mistake gets fixed — a wrong tap is noticed within seconds, and
 * before this the only route back was to leave the camera, find the person in
 * the list, and open them.
 *
 * Defaults to this staffer's own actions. At a door with three scanners the
 * event-wide feed is mostly other people's work, and the row you need to undo
 * is always one of yours.
 */
export function RecentScans({
  eventId,
  isManager,
}: {
  eventId: string;
  isManager: boolean;
}) {
  const [mine, setMine] = useState(true);
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const { deviceLabel } = useDeviceLabel();
  const utils = api.useUtils();

  const scans = api.door.recentScans.useQuery(
    { eventId, limit: 8, mine },
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
    <View style={{ gap: space.sm }}>
      <View style={styles.head}>
        <Eyebrow>{mine ? "What you did" : "Just now"}</Eyebrow>
        <Pressable onPress={() => setMine(!mine)} hitSlop={8}>
          <Caption style={styles.toggle}>
            {mine ? "Show every door" : "Show only mine"}
          </Caption>
        </Pressable>
      </View>

      {rows.length === 0 ? (
        <Caption>
          {mine ? "You have not scanned anything yet." : "Nothing yet tonight."}
        </Caption>
      ) : (
        <View style={styles.list}>
          {rows.map((scan) => {
            const good = ADMITTING.has(scan.result);
            const refused =
              scan.result === "DENIED" || scan.result === "PREVIOUSLY_DENIED";
            return (
              <View key={scan.id} style={styles.row}>
                <Pressable
                  disabled={!scan.ticketId}
                  onPress={() =>
                    scan.ticketId ? setOpenTicketId(scan.ticketId) : undefined
                  }
                  style={styles.rowMain}
                >
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor: good
                          ? colors.in
                          : refused
                            ? colors.deny
                            : colors.warn,
                      },
                    ]}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Body numberOfLines={1} style={{ fontSize: 14 }}>
                      {scan.ticket?.attendeeName ??
                        scan.ticket?.ticketNumber ??
                        "Unknown code"}
                    </Body>
                    <Caption numberOfLines={1}>
                      {[
                        LABELS[scan.result] ?? scan.result,
                        scan.denyReason
                          ? denyReasonLabel(scan.denyReason)
                          : null,
                        mine ? null : scan.scannedByName,
                        scan.deviceLabel,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Caption>
                  </View>
                  <Caption>{formatTimeAgo(new Date(scan.createdAt))}</Caption>
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
              </View>
            );
          })}
        </View>
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
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggle: { color: colors.textSoft, textDecorationLine: "underline" },
  list: {
    borderWidth: stroke.hair,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: stroke.hair,
    borderBottomColor: colors.border,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  dot: { width: 8, height: 8 },
  undo: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderLeftWidth: stroke.hair,
    borderLeftColor: colors.border,
  },
  undoLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});
