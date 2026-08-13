import { StyleSheet, View } from "react-native";

import { colors, radius, space, stroke } from "@/lib/theme";
import { Body, Caption } from "@/components/ui";
import { TapToPayMark } from "@/components/door/tap-to-pay-mark";
import { tapToPayHeadline, type TapToPayState } from "@/lib/tap-to-pay";

/**
 * How far Apple has got configuring the reader.
 *
 * Checklist 3.9.1 asks for exactly this and names the callback it must be fed
 * from — `PaymentCardReader.Event.updateProgress`, which reaches us as the
 * Terminal SDK's `onDidReportReaderSoftwareUpdateProgress`. An indeterminate
 * spinner does not satisfy it: the requirement is that the merchant can see
 * that something is happening and roughly how much is left.
 */
export function TapToPayProgress({ progress }: { progress: number | null }) {
  const percent = progress === null ? null : Math.round(progress * 100);

  return (
    <View style={{ gap: space.sm, alignSelf: "stretch" }}>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            // Indeterminate reads as a third of a bar rather than an empty one:
            // an empty bar looks like nothing is happening.
            { width: `${percent ?? 33}%` },
          ]}
        />
      </View>
      <Caption style={{ textAlign: "center" }}>
        {percent === null
          ? "Setting up Tap to Pay on iPhone…"
          : `Setting up Tap to Pay on iPhone — ${percent}%`}
      </Caption>
    </View>
  );
}

/**
 * The shared rendering of every Tap to Pay state.
 *
 * One component because the hub screen and the payment sheet have to say the
 * same thing about the same state — a handset that is "still configuring" in
 * settings and "unavailable" at checkout is exactly the confusion Apple's
 * checklist is trying to prevent.
 */
export function TapToPayStateView({
  state,
  compact,
}: {
  state: TapToPayState;
  compact?: boolean;
}) {
  const tone =
    state.status === "ready"
      ? colors.in
      : state.status === "unsupported" || state.status === "error"
        ? colors.deny
        : colors.warn;

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <TapToPayMark size={compact ? 26 : 34} color={tone} />
      <Body style={{ fontWeight: "700", textAlign: "center" }}>
        {tapToPayHeadline(state)}
      </Body>

      {state.status === "configuring" ? (
        <TapToPayProgress progress={state.progress} />
      ) : null}

      <Caption style={{ textAlign: "center" }}>{detail(state)}</Caption>
    </View>
  );
}

function detail(state: TapToPayState): string {
  switch (state.status) {
    case "ready":
      return "This iPhone can take contactless cards, Apple Pay and Google Pay.";
    case "configuring":
      // Checklist 5.7 — the merchant must be told it will be available soon,
      // not left guessing at a spinner.
      return "Apple is getting the reader ready. This only happens occasionally, and it will be available in a moment.";
    case "preparing":
      return "Connecting to the card reader.";
    case "needs-setup":
      return state.canAccept
        ? "Accept Apple's Tap to Pay on iPhone Terms and Conditions on this handset to switch it on."
        : // Checklist 3.8.1, verbatim in intent: an unauthorised user is told
          // who to go to rather than shown a button that will refuse them.
          "An Atmos admin needs to accept the Tap to Pay on iPhone Terms and Conditions on this handset before it can take card. Ask one to sign in here, or take cash and eftpos in the meantime.";
    case "unsupported":
      return state.message;
    case "error":
      return state.message;
    case "ineligible":
      return "Tap to Pay on iPhone is part of Atmos door mode. Ask an organiser to add you to an event's door staff.";
  }
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    gap: space.md,
    padding: space.xl,
    backgroundColor: colors.surface,
    borderWidth: stroke.hard,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  cardCompact: { padding: space.lg, gap: space.sm },
  track: {
    height: 6,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  fill: { height: 6, backgroundColor: colors.text },
});
