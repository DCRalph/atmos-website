import { useState } from "react";
import * as Haptics from "expo-haptics";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { api, type RouterOutputs } from "@/lib/api";
import { colors, space } from "@/lib/theme";
import { Caption } from "@/components/ui";
import { formatTimeAgo } from "@/lib/dates";

export type ScanOutcome = RouterOutputs["door"]["scan"];

/**
 * The answer, full screen and in colour.
 *
 * One rule, inherited from the web door: **the bottom button is always the
 * harmless one.** It is the button tapped a few hundred times a night without
 * being read, so it must never be the one that lets a stranger in. Overriding
 * a duplicate sits above it, bordered rather than filled, and says what it
 * will do.
 */
export function ScanResult({
  eventId,
  outcome,
  isManager,
  onDismiss,
}: {
  eventId: string;
  outcome: ScanOutcome;
  isManager: boolean;
  onDismiss: () => void;
}) {
  const [current, setCurrent] = useState(outcome);
  const utils = api.useUtils();

  const override = api.door.scan.useMutation({
    onSuccess: async (result) => {
      setCurrent(result as ScanOutcome);
      await Haptics.notificationAsync(
        result.admit
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error,
      );
      void utils.door.summary.invalidate();
      void utils.door.doorList.invalidate();
    },
  });

  const tone = toneFor(current);
  const ticket = current.ticket;

  return (
    <Modal visible animationType="fade" transparent={false}>
      <View style={[styles.screen, { backgroundColor: tone.bg }]}>
        <View style={styles.body}>
          <Text style={styles.verdict}>{tone.heading}</Text>

          {ticket ? (
            <>
              <Text style={styles.name}>
                {ticket.attendeeName ?? "No name given"}
              </Text>
              <Text style={styles.meta}>{ticket.tierName}</Text>
              <Text style={styles.mono}>{ticket.ticketNumber}</Text>
            </>
          ) : (
            <Text style={styles.meta}>{current.message}</Text>
          )}

          {current.previousAdmission ? (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Already scanned</Text>
              <Text style={styles.panelBody}>
                {formatTimeAgo(new Date(current.previousAdmission.at))}
                {current.previousAdmission.deviceLabel
                  ? ` · ${current.previousAdmission.deviceLabel}`
                  : ""}
              </Text>
            </View>
          ) : null}

          {current.previousDenial ? (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Refused earlier</Text>
              <Text style={styles.panelBody}>
                {current.previousDenial.note ?? current.previousDenial.reason}
              </Text>
            </View>
          ) : null}

          {current.isR18 ? (
            <View style={[styles.panel, styles.r18]}>
              <Text style={styles.panelTitle}>R18 — CHECK ID</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.actions}>
          {current.canOverride && isManager ? (
            <Pressable
              onPress={() =>
                override.mutate({
                  eventId,
                  token: current.ticket?.ticketNumber ?? "",
                  override: true,
                })
              }
              disabled={override.isPending}
              style={styles.exception}
            >
              <Text style={styles.exceptionLabel}>
                {override.isPending ? "Admitting…" : "Let them in anyway"}
              </Text>
              <Caption style={{ color: "rgba(255,255,255,0.7)" }}>
                Records an override against your name
              </Caption>
            </Pressable>
          ) : null}

          {/* Always last, always white, always harmless. */}
          <Pressable onPress={onDismiss} style={styles.safe}>
            <Text style={styles.safeLabel}>Next</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function toneFor(outcome: ScanOutcome): { bg: string; heading: string } {
  if (outcome.admit) {
    return {
      bg: "#047857",
      heading: outcome.result === "REENTRY" ? "BACK IN" : "IN",
    };
  }
  if (outcome.result === "DUPLICATE") {
    return { bg: "#B45309", heading: "ALREADY IN" };
  }
  if (outcome.result === "DENIED") {
    return { bg: "#B91C1C", heading: "REFUSED" };
  }
  return { bg: "#7F1D1D", heading: "NO" };
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xl,
    gap: space.sm,
  },
  verdict: {
    color: "#fff",
    fontSize: 64,
    fontWeight: "900",
    letterSpacing: -2,
  },
  name: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    marginTop: space.md,
  },
  meta: { color: "rgba(255,255,255,0.85)", fontSize: 17, textAlign: "center" },
  mono: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontFamily: "Menlo",
    marginTop: 2,
  },
  panel: {
    marginTop: space.lg,
    padding: space.lg,
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.25)",
    backgroundColor: "rgba(0,0,0,0.2)",
    width: "100%",
    maxWidth: 380,
  },
  r18: { borderColor: "rgba(255,255,255,0.5)" },
  panelTitle: { color: "#fff", fontSize: 15, fontWeight: "800" },
  panelBody: { color: "rgba(255,255,255,0.85)", fontSize: 14, marginTop: 2 },
  actions: { padding: space.lg, paddingBottom: space.xxl, gap: space.md },
  exception: {
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.3)",
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingVertical: space.md,
    alignItems: "center",
  },
  exceptionLabel: { color: "#fff", fontSize: 16, fontWeight: "700" },
  safe: {
    height: 64,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  safeLabel: {
    color: "#000",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
