import { useState } from "react";
import * as Haptics from "expo-haptics";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, type RouterOutputs } from "@/lib/api";
import { colors, space } from "@/lib/theme";
import { Caption } from "@/components/ui";
import { formatTimeAgo } from "@/lib/dates";
import { labelArg, useDeviceLabel } from "@/lib/device-label";
import { DenySheet } from "@/components/door/deny-sheet";
import { AccessBadge } from "@/components/door/access-badge";

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
  const [denying, setDenying] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { deviceLabel } = useDeviceLabel();
  const utils = api.useUtils();

  /**
   * Turning somebody away, from the scan itself.
   *
   * This used to be reachable only by finding the person in the list — which
   * is the one thing nobody can do with a queue in front of them. A refusal
   * recorded here is the same record the list shows later, with the reason
   * attached, so "why was I turned away" has an answer.
   */
  const deny = api.door.deny.useMutation({
    onSuccess: async (result) => {
      setDenying(false);
      setCurrent(result as ScanOutcome);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      void utils.door.summary.invalidate();
      void utils.door.doorList.invalidate();
      void utils.door.ticketDetail.invalidate();
      void utils.door.recentScans.invalidate();
    },
  });

  /**
   * Admitting past a duplicate.
   *
   * Goes through `admitByTicketNumber`, not `scan`. All this screen still has
   * is the ticket number — the signed QR token is long gone — and `scan` reads
   * its `token` as that signed payload, so passing a ticket number made the
   * server correctly answer that it is not an Atmos ticket. Both endpoints
   * funnel into the same admit path server-side.
   */
  const override = api.door.admitByTicketNumber.useMutation({
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
        {/* Scrolls rather than stretching: with a name, a badge, a duplicate
            warning, a photo-ID line and an R18 flag all showing at once, a
            fixed body ran straight under the buttons. */}
        <ScrollView
          contentContainerStyle={[
            styles.body,
            { paddingTop: insets.top + space.lg },
          ]}
        >
          <Text
            style={styles.verdict}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {tone.heading}
          </Text>

          {ticket ? (
            <>
              <Text style={styles.name}>
                {ticket.attendeeName ?? "No name given"}
              </Text>
              {/* On every result, admitted or not — the moment this matters
                  most is the one where the scan came back wrong. */}
              <View style={{ marginTop: space.sm }}>
                <AccessBadge level={ticket.accessLevel} />
              </View>
              {/* Who put them on the list. This is what a manager decides on
                  when a guest-list name comes back wrong. */}
              {ticket.invitedByName ? (
                <Text style={styles.invited}>
                  Invited by {ticket.invitedByName}
                </Text>
              ) : null}
              <Text style={styles.meta}>{ticket.tierName}</Text>
              <Text style={styles.mono}>
                {ticket.ticketNumber} · {ticket.positionInOrder}
                {ticket.isComp ? " · comp" : ""}
              </Text>
              {/* Only when there is no attendee name to show instead —
                  otherwise the buyer is noise on a ticket that names someone. */}
              {!ticket.attendeeName && ticket.buyerName ? (
                <Text style={styles.mono}>Bought by {ticket.buyerName}</Text>
              ) : null}
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

          {/* Without this the name above is decoration. A locked ticket is one
              where the person holding it is supposed to be the person named on
              it, and only the door can check that. */}
          {ticket?.nameLocked && ticket.attendeeName ? (
            <View style={[styles.panel, styles.idCheck]}>
              <Text style={styles.panelTitle}>PHOTO ID</Text>
              <Text style={styles.panelBody}>
                This ticket is in the name of {ticket.attendeeName}
              </Text>
            </View>
          ) : null}

          {current.isR18 ? (
            <View style={[styles.panel, styles.r18]}>
              <Text style={styles.panelTitle}>R18 — CHECK ID</Text>
            </View>
          ) : null}
        </ScrollView>

        <View
          style={[
            styles.actions,
            { paddingBottom: insets.bottom + space.lg },
          ]}
        >
          {/* Only when there is a ticket to refuse: an unreadable or foreign
              code has nobody to record it against. */}
          {current.ticket ? (
            <Pressable
              onPress={() => setDenying(true)}
              disabled={deny.isPending}
              style={styles.refuse}
            >
              <Text style={styles.refuseLabel}>
                {deny.isPending ? "Refusing…" : "Refuse entry"}
              </Text>
              <Caption style={{ color: "rgba(255,255,255,0.7)" }}>
                Asks why, and records it against your name
              </Caption>
            </Pressable>
          ) : null}

          {current.canOverride && isManager ? (
            <Pressable
              onPress={() =>
                override.mutate({
                  eventId,
                  ticketNumber: current.ticket?.ticketNumber ?? "",
                  override: true,
                  deviceLabel: labelArg(deviceLabel),
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

          {/* The way out when the code is the problem rather than the person:
              a smashed screen, a forwarded email, the wrong QR entirely. Takes
              the name it already knows straight into the list search. */}
          <Pressable
            onPress={() => {
              const q =
                current.ticket?.attendeeName ??
                current.ticket?.buyerName ??
                current.ticket?.ticketNumber ??
                "";
              onDismiss();
              router.push({
                pathname: "/(door)/[eventId]/list",
                params: { eventId, q },
              });
            }}
            style={styles.findOnList}
          >
            <Text style={styles.findLabel}>Find them on the list</Text>
          </Pressable>

          {/* Always last, always white, always harmless. */}
          <Pressable onPress={onDismiss} style={styles.safe}>
            <Text style={styles.safeLabel}>Next</Text>
          </Pressable>
        </View>
      </View>

      {denying && current.ticket ? (
        <DenySheet
          attendee={current.ticket.attendeeName ?? current.ticket.buyerName}
          pending={deny.isPending}
          onCancel={() => setDenying(false)}
          onConfirm={(reason, note) =>
            deny.mutate({
              eventId,
              ticketId: current.ticket!.id,
              reason,
              note: note || undefined,
              deviceLabel: labelArg(deviceLabel),
            })
          }
        />
      ) : null}
    </Modal>
  );
}

/**
 * Colour and verdict word per result, matching the web scanner case for case.
 *
 * Keyed off `result` rather than the `admit` flag, which is what previously let
 * `PREVIOUSLY_DENIED` fall through to a bare "NO" — hiding the one fact that
 * decides what happens next, that somebody has already turned this person away.
 * A re-entry gets its own colour for the same reason it does on the web: it is
 * neither a fresh admission nor a problem, and staff read the colour before
 * they read the word.
 */
function toneFor(outcome: ScanOutcome): { bg: string; heading: string } {
  switch (outcome.result) {
    case "ADMITTED":
    case "OVERRIDE_ADMITTED":
      return { bg: "#047857", heading: "IN" };
    case "REENTRY":
      return { bg: "#0284C7", heading: "RE-ENTRY" };
    case "DUPLICATE":
      return { bg: "#B45309", heading: "ALREADY ADMITTED" };
    case "DENIED":
      return { bg: "#B91C1C", heading: "REFUSED" };
    case "PREVIOUSLY_DENIED":
      return { bg: "#B91C1C", heading: "REFUSED EARLIER" };
    default:
      return { bg: "#7F1D1D", heading: "NO ENTRY" };
  }
}

const styles = StyleSheet.create({
  idCheck: { borderColor: "rgba(255,255,255,0.55)" },
  invited: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    marginTop: space.sm,
  },
  findOnList: {
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
    paddingVertical: space.md,
    alignItems: "center",
  },
  findLabel: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  refuse: {
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.55)",
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    alignItems: "center",
    gap: 2,
  },
  refuseLabel: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  screen: { flex: 1 },
  body: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xl,
    paddingBottom: space.xl,
    gap: space.sm,
  },
  verdict: {
    color: "#fff",
    // 64 wrapped "ALREADY IN" onto two lines and pushed it under the notch.
    // Shrunk here and capped to one line below, so a longer verdict scales
    // itself down rather than reflowing the whole screen.
    fontSize: 46,
    fontWeight: "900",
    letterSpacing: -1.5,
    textAlign: "center",
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
  actions: { padding: space.lg, gap: space.md },
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
