import { useCallback, useEffect, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import {
  useStripeTerminal,
  type Reader,
} from "@stripe/stripe-terminal-react-native";
import { Modal, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/lib/api";
import { colors, radius, space } from "@/lib/theme";
import { Body, Button, Caption, Loading, Title } from "@/components/ui";

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

type Stage =
  | "connecting"
  | "creating"
  | "waiting-for-tap"
  | "processing"
  | "issuing"
  | "done"
  | "failed";

/**
 * Take a contactless payment on the phone itself.
 *
 * The order of operations is the whole design. Stock is held and a payment is
 * opened first; the tap happens; only once the server has re-read the intent
 * from Stripe and seen it succeed are tickets minted. Nothing here can issue a
 * ticket on this component's say-so — a declined card that walked away holding
 * a valid ticket is the failure mode this shape exists to prevent.
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
  onSold: (orderNumber: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [stage, setStage] = useState<Stage>("connecting");
  const [error, setError] = useState<string | null>(null);
  const orderRef = useRef<string | null>(null);
  const settled = useRef(false);

  const {
    connectReader,
    connectedReader,
    discoverReaders,
    discoveredReaders,
    collectPaymentMethod,
    confirmPaymentIntent,
    retrievePaymentIntent,
  } = useStripeTerminal();

  const terminal = api.terminal.config.useQuery(undefined, { retry: false });
  const createIntent = api.door.createSaleIntent.useMutation();
  const complete = api.door.completeSale.useMutation();
  const abandon = api.door.abandonSale.useMutation();

  const locationId = terminal.data?.locationId ?? null;

  // Give the stock back if the sheet closes before the money lands.
  useEffect(() => {
    return () => {
      if (settled.current || !orderRef.current) return;
      abandon.mutate({ eventId, orderId: orderRef.current });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // On iOS the "reader" is this phone, so discovery resolves to one local
  // handle almost immediately rather than scanning for hardware.
  useEffect(() => {
    if (connectedReader) return;
    void discoverReaders({ discoveryMethod: "tapToPay", simulated: __DEV__ });
  }, [connectedReader, discoverReaders]);

  useEffect(() => {
    if (connectedReader || discoveredReaders.length === 0) return;
    const reader = discoveredReaders[0] as Reader.Type | undefined;
    if (!reader) return;

    // Stripe scopes every reader to a Location, so without one there is
    // nothing to connect to. Say so plainly rather than failing deep inside
    // the SDK with a message nobody at a door can act on.
    if (!locationId) {
      setError(
        "No Stripe Terminal location is configured. Set STRIPE_TERMINAL_LOCATION_ID on the server.",
      );
      setStage("failed");
      return;
    }

    void (async () => {
      const { error: connectError } = await connectReader({
        discoveryMethod: "tapToPay",
        reader,
        locationId,
        merchantDisplayName: "Atmos",
      });
      if (connectError) {
        setError(connectError.message);
        setStage("failed");
      }
    })();
  }, [connectedReader, discoveredReaders, connectReader, locationId]);

  const run = useCallback(async () => {
    setError(null);
    try {
      setStage("creating");
      const order = await createIntent.mutateAsync({ eventId, lines });
      orderRef.current = order.orderId;

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
        throw new Error(collectError?.message ?? "No card was read.");
      }

      setStage("processing");
      const { error: confirmError } = await confirmPaymentIntent({
        paymentIntent: collected,
      });
      if (confirmError) {
        throw new Error(confirmError.message);
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
      setStage("done");
      onSold(result.orderNumber);
    } catch (cause) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(cause instanceof Error ? cause.message : "That didn't go through.");
      setStage("failed");
    }
  }, [
    eventId,
    lines,
    deviceLabel,
    createIntent,
    complete,
    retrievePaymentIntent,
    collectPaymentMethod,
    confirmPaymentIntent,
    onSold,
  ]);

  const ready = !!connectedReader;

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
        <View style={styles.body}>
          <Title style={{ textAlign: "center" }}>{money(totalCents)}</Title>

          {stage === "connecting" && !ready ? (
            <Loading label="Getting the reader ready" />
          ) : null}

          {ready && stage === "connecting" ? (
            <Body soft style={{ textAlign: "center" }}>
              Ready. Tap below, then hold their card to the top of the phone.
            </Body>
          ) : null}

          {stage === "waiting-for-tap" ? (
            <View style={styles.prompt}>
              <Body style={styles.big}>Hold card to phone</Body>
              <Caption style={{ textAlign: "center" }}>
                Card, Apple Pay or Google Pay — near the top edge.
              </Caption>
            </View>
          ) : null}

          {stage === "creating" || stage === "processing" ? (
            <Loading label="Processing" />
          ) : null}

          {stage === "issuing" ? <Loading label="Issuing tickets" /> : null}

          {stage === "done" ? (
            <Body style={[styles.big, { color: colors.in }]}>Paid</Body>
          ) : null}

          {error ? (
            <View style={styles.error}>
              <Caption style={{ color: colors.deny }}>{error}</Caption>
            </View>
          ) : null}
        </View>

        <View style={styles.actions}>
          {stage === "connecting" && ready ? (
            <Button onPress={() => void run()}>Take payment</Button>
          ) : null}
          {stage === "failed" ? (
            <Button onPress={() => void run()}>Try again</Button>
          ) : null}
          {/* Bottom button, always harmless — the door's rule everywhere. */}
          <Button
            variant="outline"
            disabled={stage === "processing" || stage === "issuing"}
            onPress={onClose}
          >
            {stage === "done" ? "Done" : "Cancel"}
          </Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#111" },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xl,
    gap: space.lg,
  },
  big: { fontSize: 26, fontWeight: "800", textAlign: "center" },
  prompt: { alignItems: "center", gap: space.sm },
  error: {
    padding: space.md,
    borderRadius: radius.sm,
    backgroundColor: colors.denyDim,
  },
  actions: {
    padding: space.lg,
    paddingBottom: space.xxl,
    gap: space.sm,
  },
});
