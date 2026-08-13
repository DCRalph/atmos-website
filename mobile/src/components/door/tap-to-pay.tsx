import { useCallback, useEffect, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import { useStripeTerminal } from "@stripe/stripe-terminal-react-native";
import { Modal, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/lib/api";
import { colors, radius, space } from "@/lib/theme";
import { useTapToPay } from "@/lib/tap-to-pay";
import { Body, Button, Caption, Loading, Title } from "@/components/ui";
import { TapToPayStateView } from "@/components/door/tap-to-pay-state";
import { DoorReceiptPrompt } from "@/components/door/receipt-prompt";

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/**
 * How the tap ended, in the three words Apple's checklist 5.9 asks for.
 *
 * Everything the SDK can throw lands in one of these. A generic "that didn't
 * work" is what this replaced, and it is the wrong answer at a door: "declined"
 * means ask for another card, "not completed" means try the tap again, and
 * telling them apart is the difference between a queue moving and a queue
 * watching somebody re-tap a card the bank has already refused.
 */
type Verdict = "approved" | "declined" | "timed-out";

type Stage =
  | "idle"
  | "creating"
  | "waiting-for-tap"
  | "processing"
  | "issuing"
  | "settled";

/** Collect failed: nothing was ever read. */
const TIMEOUT_CODES = new Set([
  "CANCELED",
  "CARD_READ_TIMED_OUT",
  "REQUEST_TIMED_OUT",
  "TAP_TO_PAY_READER_REQUEST_INTERRUPTED",
  "CARD_REMOVED",
]);

/**
 * Take a contactless payment on the phone itself.
 *
 * The order of operations is the whole design. Stock is held and a payment is
 * opened first; the tap happens; only once the server has re-read the intent
 * from Stripe and seen it succeed are tickets minted. Nothing here can issue a
 * ticket on this component's say-so — a declined card that walked away holding
 * a valid ticket is the failure mode this shape exists to prevent.
 *
 * What changed for Apple's App Review checklist:
 *
 * - **5.6** the reader is warmed up at app launch by `lib/tap-to-pay`, so this
 *   sheet opens onto a live connection and goes straight to collecting. It no
 *   longer runs its own discovery, which is what used to put several seconds
 *   between the button and Apple's sheet.
 * - **5.7** if the reader is still being configured, that is shown with real
 *   progress rather than an indeterminate spinner.
 * - **5.9** approved, declined and timed out are three different endings.
 * - **5.10** a receipt can be sent for a decline, not just for a sale.
 */
export function TapToPaySheet({
  eventId,
  lines,
  totalCents,
  deviceLabel,
  onClose,
  onSold,
}: {
  eventId: string;
  lines: { tierId: string; quantity: number }[];
  totalCents: number;
  deviceLabel?: string;
  onClose: () => void;
  onSold: (orderNumber: string, receiptId?: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { state, isReady, retry } = useTapToPay();

  const [stage, setStage] = useState<Stage>("idle");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);

  const orderRef = useRef<string | null>(null);
  const intentRef = useRef<string | null>(null);
  const settled = useRef(false);
  const started = useRef(false);

  const { collectPaymentMethod, confirmPaymentIntent, retrievePaymentIntent } =
    useStripeTerminal();

  const createIntent = api.door.createSaleIntent.useMutation();
  const complete = api.door.completeSale.useMutation();
  const abandon = api.door.abandonSale.useMutation();
  const recordDeclined = api.door.recordDeclinedSale.useMutation();

  // Give the stock back if the sheet closes before the money lands.
  useEffect(() => {
    return () => {
      if (settled.current || !orderRef.current) return;
      abandon.mutate({ eventId, orderId: orderRef.current });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const run = useCallback(async () => {
    setVerdict(null);
    setDetail(null);
    setReceiptId(null);

    try {
      setStage("creating");
      const order = await createIntent.mutateAsync({ eventId, lines });
      orderRef.current = order.orderId;
      intentRef.current = order.paymentIntentId;

      if (!order.clientSecret) {
        throw new Error("That sale didn't open a payment.");
      }

      const { paymentIntent, error: retrieveError } =
        await retrievePaymentIntent(order.clientSecret);
      if (retrieveError || !paymentIntent) {
        throw new Error(retrieveError?.message ?? "Couldn't open the payment.");
      }

      setStage("waiting-for-tap");
      const { paymentIntent: collected, error: collectError } =
        await collectPaymentMethod({ paymentIntent });
      if (collectError || !collected) {
        // Nothing was read. Not a decline — the card never got that far.
        const code = collectError?.code;
        throw Object.assign(
          new Error(collectError?.message ?? "No card was read."),
          {
            verdict: (code && !TIMEOUT_CODES.has(code)
              ? "declined"
              : "timed-out") satisfies Verdict,
          },
        );
      }

      setStage("processing");
      const { error: confirmError } = await confirmPaymentIntent({
        paymentIntent: collected,
      });
      if (confirmError) {
        // The card was read and the bank said no.
        throw Object.assign(new Error(confirmError.message), {
          verdict: "declined" satisfies Verdict,
        });
      }

      // The server checks Stripe itself before issuing — this call is a
      // request to look, not an assertion that it worked.
      setStage("issuing");
      const result = await complete.mutateAsync({
        eventId,
        orderId: order.orderId,
        deviceLabel,
        admitNow: true,
      });

      settled.current = true;
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setVerdict("approved");
      setReceiptId(result.receiptId ?? null);
      setStage("settled");
      onSold(result.orderNumber, result.receiptId ?? undefined);
    } catch (cause) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      const outcome =
        (cause as { verdict?: Verdict }).verdict ?? ("declined" as const);
      setVerdict(outcome);
      setDetail(
        cause instanceof Error ? cause.message : "That didn't go through.",
      );
      setStage("settled");

      /**
       * Checklist 5.10 — the receipt for a tap that did not become a sale.
       *
       * Written before the hold is released on unmount, and never allowed to
       * fail the flow: a customer standing at a door does not care that the
       * receipt row could not be created, and neither should the sale that is
       * about to be retried.
       */
      recordDeclined.mutate(
        {
          eventId,
          orderId: orderRef.current ?? undefined,
          paymentIntentId: intentRef.current ?? undefined,
          outcome: outcome === "declined" ? "DECLINED" : "TIMED_OUT",
          amountCents: totalCents,
          deviceLabel,
        },
        { onSuccess: (result) => setReceiptId(result.receiptId) },
      );
    }
  }, [
    eventId,
    lines,
    totalCents,
    deviceLabel,
    createIntent,
    complete,
    recordDeclined,
    retrievePaymentIntent,
    collectPaymentMethod,
    confirmPaymentIntent,
    onSold,
  ]);

  /**
   * Start as soon as there is a reader.
   *
   * The staffer already pressed "Charge $X with Tap to Pay on iPhone" — making
   * them press a second button inside this sheet is the delay checklist 5.6 is
   * about. Because the reader is warmed up at launch, `isReady` is almost
   * always true on the very first render.
   */
  useEffect(() => {
    if (!isReady || started.current) return;
    started.current = true;
    void run();
  }, [isReady, run]);

  const again = useCallback(() => {
    // A fresh order: the previous one is cancelled and its stock returned.
    if (orderRef.current && !settled.current) {
      abandon.mutate({ eventId, orderId: orderRef.current });
    }
    orderRef.current = null;
    intentRef.current = null;
    setStage("idle");
    void run();
  }, [abandon, eventId, run]);

  const busy = stage === "processing" || stage === "issuing";

  return (
    <Modal visible animationType="slide" transparent={false}>
      <View
        style={[
          styles.screen,
          // Full-screen modals sit under the notch and the home indicator
          // otherwise — the verdict ran into the Dynamic Island.
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          <Title style={{ textAlign: "center" }}>{money(totalCents)}</Title>

          {/*
            The reader is not ready. Checklist 5.7 wants an "initializing"
            screen with the configuration progress rather than a dead button,
            and 5.3 means arriving here is a normal path — the sell screen never
            greys the option out.
          */}
          {!isReady && stage === "idle" ? (
            <TapToPayStateView state={state} compact />
          ) : null}

          {stage === "creating" ? <Loading label="Opening the payment" /> : null}

          {stage === "waiting-for-tap" ? (
            <View style={styles.prompt}>
              <Body style={styles.big}>Hold card to phone</Body>
              <Caption style={{ textAlign: "center" }}>
                Card, Apple Pay or Google Pay — near the top edge.
              </Caption>
            </View>
          ) : null}

          {/* 5.8 — a distinct processing screen once the card has been read. */}
          {stage === "processing" ? <Loading label="Processing" /> : null}
          {stage === "issuing" ? <Loading label="Issuing tickets" /> : null}

          {/* 5.9 — three endings, said plainly. */}
          {verdict === "approved" ? (
            <View style={styles.prompt}>
              <Body style={[styles.big, { color: colors.in }]}>Approved</Body>
              <Caption style={{ textAlign: "center" }}>
                Paid. Their tickets are issued and they&apos;re counted as
                inside.
              </Caption>
            </View>
          ) : null}

          {verdict === "declined" ? (
            <View style={styles.prompt}>
              <Body style={[styles.big, { color: colors.deny }]}>Declined</Body>
              <Caption style={{ textAlign: "center" }}>
                Nothing has been charged. Ask for another card or a phone wallet
                — or take cash and record it on the Sell screen.
              </Caption>
            </View>
          ) : null}

          {verdict === "timed-out" ? (
            <View style={styles.prompt}>
              <Body style={[styles.big, { color: colors.warn }]}>
                No card read
              </Body>
              <Caption style={{ textAlign: "center" }}>
                The tap didn&apos;t complete and nothing has been charged. Try
                again, holding the card to the top of the phone until it buzzes.
              </Caption>
            </View>
          ) : null}

          {detail ? (
            <View style={styles.detail}>
              <Caption style={{ color: colors.textSoft }}>{detail}</Caption>
            </View>
          ) : null}

          {/* 5.10 — offered for the decline as much as for the sale. */}
          {receiptId ? (
            <DoorReceiptPrompt
              receiptId={receiptId}
              declined={verdict !== "approved"}
            />
          ) : null}
        </ScrollView>

        <View style={styles.actions}>
          {stage === "settled" && verdict !== "approved" ? (
            <Button onPress={again}>Try the tap again</Button>
          ) : null}

          {/* A reader that failed for a retryable reason, before any money. */}
          {!isReady && stage === "idle" && state.status === "error" ? (
            <Button onPress={retry}>Try again</Button>
          ) : null}

          {/* Bottom button, always harmless — the door's rule everywhere. */}
          <Button variant="outline" disabled={busy} onPress={onClose}>
            {verdict === "approved" ? "Done" : "Cancel"}
          </Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#111" },
  body: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xl,
    gap: space.lg,
  },
  big: { fontSize: 26, fontWeight: "800", textAlign: "center" },
  prompt: { alignItems: "center", gap: space.sm },
  detail: {
    padding: space.md,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    alignSelf: "stretch",
  },
  actions: {
    padding: space.lg,
    paddingBottom: space.xxl,
    gap: space.sm,
  },
});
