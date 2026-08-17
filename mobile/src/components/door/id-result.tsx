import { useState } from "react";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, type RouterOutputs } from "@/lib/api";
import { space } from "@/lib/theme";
import { Caption } from "@/components/ui";
import { labelArg, useDeviceLabel } from "@/lib/device-label";
import { BanSheet } from "@/components/door/ban-sheet";
import { DenySheet } from "@/components/door/deny-sheet";

export type IdOutcome = RouterOutputs["door"]["checkId"];

/**
 * The answer about the person, full screen and in colour.
 *
 * Same rules as the ticket scan result next door: colour first, one enormous
 * word, and **the bottom button is always the harmless one**. What differs is
 * what is being decided. A ticket result is about a code; this is about a human
 * being, and two things follow from that.
 *
 * First, the photograph. The portrait sits under the verdict at a size that can
 * actually be compared to a face, because every check here ends with a person
 * looking from the screen to the queue and back. A green screen against the
 * wrong face is worse than no check at all.
 *
 * Second, the honesty line at the bottom. Nothing in this system detects a good
 * fake — it reads what is printed and does the arithmetic — and a door that
 * forgets that will wave through a well-made forgery precisely because the
 * phone went green. So the screen says so, every time, including on a pass.
 */
export function IdResult({
  eventId,
  outcome,
  ticketId,
  attendeeName,
  isManager,
  /** The crop this phone just took, shown before any round trip for it. */
  localPortrait,
  onRetake,
  onDismiss,
}: {
  eventId: string;
  outcome: IdOutcome;
  ticketId?: string;
  attendeeName?: string | null;
  isManager: boolean;
  localPortrait: string | null;
  onRetake: () => void;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(outcome);
  const [banning, setBanning] = useState(false);
  const [refusing, setRefusing] = useState(false);
  const { deviceLabel } = useDeviceLabel();
  const utils = api.useUtils();

  const ban = api.door.banPatron.useMutation({
    onSuccess: async () => {
      setBanning(false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      // The verdict on screen is now out of date in the one way that matters.
      setCurrent({
        ...current,
        result: "BANNED",
        ok: false,
        headline: "Banned",
        message: "Barred from Atmos events from now on.",
      });
      void utils.door.idCheckSummary.invalidate();
    },
  });

  const deny = api.door.deny.useMutation({
    onSuccess: async () => {
      setRefusing(false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      void utils.door.summary.invalidate();
      void utils.door.doorList.invalidate();
      void utils.door.recentScans.invalidate();
      onDismiss();
    },
  });

  const tone = toneFor(current.result);
  const person = current.person;

  return (
    <Modal visible animationType="fade" transparent={false}>
      <View style={[styles.screen, { backgroundColor: tone.bg }]}>
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
            minimumFontScale={0.5}
          >
            {current.headline}
          </Text>

          {localPortrait || person?.photoPath ? (
            <Image
              source={
                localPortrait
                  ? { uri: `data:image/jpeg;base64,${localPortrait}` }
                  : { uri: person?.photoPath ?? "" }
              }
              style={styles.portrait}
              contentFit="cover"
              accessibilityLabel="Photo from the ID"
            />
          ) : null}

          {person ? (
            <>
              <Text style={styles.name}>{person.fullName}</Text>
              <Text style={styles.meta}>
                {person.dateOfBirth} · {person.ageYears} years old
              </Text>

              {/* How many times we have seen them, which is the answer to
                  "do we know this person" and is worth as much to a door as
                  the verdict itself. */}
              <Text style={styles.mono}>
                {person.previousChecks === 0
                  ? "First time we've checked this ID"
                  : `Checked ${person.previousChecks}× before · ${person.previousVisits} other night${person.previousVisits === 1 ? "" : "s"}`}
              </Text>
            </>
          ) : (
            <Text style={styles.meta}>{current.message}</Text>
          )}

          {person ? <Text style={styles.message}>{current.message}</Text> : null}

          {current.ban ? (
            <View style={[styles.panel, styles.banPanel]}>
              <Text style={styles.panelTitle}>
                BANNED{current.ban.expiresAt ? " — UNTIL FURTHER NOTICE" : ""}
              </Text>
              <Text style={styles.panelBody}>
                {current.ban.note ?? current.ban.reason}
                {current.ban.bannedByName
                  ? `\nSet by ${current.ban.bannedByName}`
                  : ""}
              </Text>
            </View>
          ) : null}

          {/* Everything wrong, not only the headline. An expired card on an
              underage punter is two facts, and hiding the second behind the
              first is how the second gets missed. */}
          {current.warnings.map((warning) => (
            <View key={`${warning.code}-${warning.label}`} style={styles.panel}>
              <Text style={styles.panelTitle}>
                {warning.label.toUpperCase()}
              </Text>
              <Text style={styles.panelBody}>{warning.detail}</Text>
            </View>
          ))}

          <Text style={styles.disclaimer}>
            This reads what's printed. It can't spot a good fake — look at the
            card.
          </Text>
        </ScrollView>

        <View
          style={[styles.actions, { paddingBottom: insets.bottom + space.lg }]}
        >
          {/* Refusing needs a ticket to record against, exactly as it does on
              the scan result. An ID checked on its own has nothing to attach
              a refusal to — the ban below is the tool for that case. */}
          {ticketId ? (
            <Pressable
              onPress={() => setRefusing(true)}
              disabled={deny.isPending}
              style={styles.exception}
            >
              <Text style={styles.exceptionLabel}>
                {deny.isPending ? "Refusing…" : "Refuse entry"}
              </Text>
              <Caption style={{ color: "rgba(255,255,255,0.7)" }}>
                Records it against their ticket and your name
              </Caption>
            </Pressable>
          ) : null}

          {isManager && person ? (
            <Pressable
              onPress={() => setBanning(true)}
              disabled={ban.isPending}
              style={styles.exception}
            >
              <Text style={styles.exceptionLabel}>
                {ban.isPending ? "Banning…" : "Ban from all events"}
              </Text>
              <Caption style={{ color: "rgba(255,255,255,0.7)" }}>
                Every future door sees it until it's lifted
              </Caption>
            </Pressable>
          ) : null}

          {/* The way out when the reading is the problem rather than the
              person — glare on the plastic, a thumb over the birthday. */}
          <Pressable onPress={onRetake} style={styles.secondary}>
            <Text style={styles.secondaryLabel}>Read it again</Text>
          </Pressable>

          {/* Always last, always white, always harmless. */}
          <Pressable onPress={onDismiss} style={styles.safe}>
            <Text style={styles.safeLabel}>Next</Text>
          </Pressable>
        </View>
      </View>

      {banning && person ? (
        <BanSheet
          name={person.fullName}
          pending={ban.isPending}
          onCancel={() => setBanning(false)}
          onConfirm={(reason, note, expiresInDays) =>
            ban.mutate({
              eventId,
              patronId: person.patronId,
              reason,
              note: note || undefined,
              expiresInDays: expiresInDays ?? undefined,
            })
          }
        />
      ) : null}

      {refusing && ticketId ? (
        <DenySheet
          attendee={person?.fullName ?? attendeeName ?? null}
          pending={deny.isPending}
          onCancel={() => setRefusing(false)}
          onConfirm={(reason, note) =>
            deny.mutate({
              eventId,
              ticketId,
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
 * Colour and word per verdict, matching the ticket scanner case for case so
 * that green means the same thing on both screens.
 *
 * The three amber cases are the ones where the system is reporting a fact and
 * a human makes the call: a card that expired last month, a name that doesn't
 * match, an ID seen twice tonight. Red is reserved for the two that are not
 * judgement calls — barred, and under age.
 */
function toneFor(result: IdOutcome["result"]): { bg: string } {
  switch (result) {
    case "PASS":
      return { bg: "#047857" };
    case "BANNED":
      return { bg: "#7F1D1D" };
    case "UNDERAGE":
      return { bg: "#B91C1C" };
    case "DOCUMENT_EXPIRED":
    case "NOT_APPROVED_EVIDENCE":
    case "ALREADY_USED_TONIGHT":
    case "NAME_MISMATCH":
      return { bg: "#B45309" };
    default:
      return { bg: "#3F3F46" };
  }
}

const styles = StyleSheet.create({
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
    fontSize: 44,
    fontWeight: "900",
    letterSpacing: -1.5,
    textAlign: "center",
  },
  /**
   * Big enough to compare with a face at arm's length. A thumbnail would be
   * decoration, and decoration is what this must not be.
   */
  portrait: {
    width: 132,
    height: 160,
    marginTop: space.md,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  name: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    marginTop: space.md,
  },
  meta: { color: "rgba(255,255,255,0.85)", fontSize: 17, textAlign: "center" },
  message: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 15,
    textAlign: "center",
    marginTop: space.sm,
  },
  mono: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontFamily: "Menlo",
    marginTop: 2,
    textAlign: "center",
  },
  panel: {
    marginTop: space.md,
    padding: space.lg,
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.25)",
    backgroundColor: "rgba(0,0,0,0.2)",
    width: "100%",
    maxWidth: 380,
  },
  banPanel: { borderColor: "rgba(255,255,255,0.55)" },
  panelTitle: { color: "#fff", fontSize: 15, fontWeight: "800" },
  panelBody: { color: "rgba(255,255,255,0.85)", fontSize: 14, marginTop: 2 },
  disclaimer: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    textAlign: "center",
    marginTop: space.lg,
    maxWidth: 320,
  },
  actions: { padding: space.lg, gap: space.md },
  exception: {
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.55)",
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    alignItems: "center",
    gap: 2,
  },
  exceptionLabel: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  secondary: {
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
    paddingVertical: space.md,
    alignItems: "center",
  },
  secondaryLabel: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
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
