import { useCallback, useEffect, useRef, useState } from "react";
import { useStripe } from "@stripe/stripe-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/lib/api";
import { colors, space } from "@/lib/theme";
import { formatCountdown } from "@/lib/dates";
import { Body, Button, Caption, Loading, Title } from "@/components/ui";

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/**
 * Pay.
 *
 * Two things the web checkout never had to handle. The hold is shown as a
 * countdown, because a reservation that expires invisibly is a reservation
 * that turns into a confusing error. And the stock is released when the screen
 * is abandoned — people put a phone in a pocket mid-purchase far more often
 * than they close a browser tab, and every one of those would otherwise sit on
 * held stock until it timed out.
 */
export default function PayScreen() {
  const { slug, orderId, token, clientSecret, total, expiresAt } =
    useLocalSearchParams<{
      slug: string;
      orderId: string;
      token: string;
      clientSecret: string;
      total: string;
      expiresAt: string;
    }>();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [remaining, setRemaining] = useState(() => msLeft(expiresAt));

  /** Set once the order is paid, so unmount stops trying to release it. */
  const settled = useRef(false);

  const confirm = api.ticketCheckout.confirm.useMutation();
  const release = api.ticketCheckout.release.useMutation();
  const utils = api.useUtils();

  const totalCents = Number(total) || 0;

  useEffect(() => {
    const timer = setInterval(() => setRemaining(msLeft(expiresAt)), 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  // Give the stock back on the way out — unless it has been paid for.
  useEffect(() => {
    return () => {
      if (settled.current || !orderId) return;
      release.mutate({ orderId });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // Backgrounding the app is abandonment often enough to matter at an on-sale.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" && !settled.current && orderId) {
        release.mutate({ orderId });
        router.back();
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!clientSecret) {
        // A free order needs no sheet — it is claimed, not paid for.
        setReady(true);
        return;
      }
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: "Atmos",
        paymentIntentClientSecret: clientSecret,
        applePay: { merchantCountryCode: "NZ" },
        googlePay: { merchantCountryCode: "NZ", testEnv: __DEV__ },
        style: "alwaysDark",
        returnURL: "atmos://checkout",
      });
      if (cancelled) return;
      if (initError) setError(initError.message);
      else setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientSecret, initPaymentSheet]);

  const pay = useCallback(async () => {
    setPaying(true);
    setError(null);
    try {
      const { error: sheetError } = await presentPaymentSheet();
      if (sheetError) {
        // Cancelling is not an error worth shouting about.
        if (sheetError.code !== "Canceled") setError(sheetError.message);
        return;
      }

      // The webhook usually issues first; this makes the app independent of it.
      const result = await confirm.mutateAsync({ accessToken: token });
      if (result.status !== "PAID") {
        setError("Payment went through but tickets are still issuing. Check your email in a moment.");
        return;
      }

      settled.current = true;
      void utils.tickets.mine.invalidate();
      router.replace({
        pathname: "/(checkout)/[slug]/done",
        params: { slug, token },
      });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "That payment didn't complete.",
      );
    } finally {
      setPaying(false);
    }
  }, [presentPaymentSheet, confirm, token, utils, router, slug]);

  const expired = remaining <= 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.close}>‹</Text>
        </Pressable>
        <Title style={{ fontSize: 18 }}>Payment</Title>
        <View style={{ width: 24 }} />
      </View>

      <View style={{ flex: 1, padding: space.lg, gap: space.lg }}>
        <View style={[styles.hold, expired && styles.holdExpired]}>
          <Body style={{ fontWeight: "700" }}>
            {expired ? "Hold expired" : `Held for ${formatCountdown(remaining)}`}
          </Body>
          <Caption>
            {expired
              ? "Those tickets went back on sale. Start again to pick them up."
              : "Your tickets are reserved until the timer runs out."}
          </Caption>
        </View>

        <View style={styles.total}>
          <Body style={{ fontWeight: "700" }}>Total</Body>
          <Body style={{ fontWeight: "700" }}>{money(totalCents)}</Body>
        </View>

        {error ? (
          <View style={styles.error}>
            <Caption style={{ color: colors.deny }}>{error}</Caption>
          </View>
        ) : null}

        {!ready && !error ? <Loading label="Preparing payment" /> : null}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>
        {expired ? (
          <Button onPress={() => router.replace({ pathname: "/(checkout)/[slug]/tiers", params: { slug } })}>
            Start again
          </Button>
        ) : (
          <Button disabled={!ready} loading={paying} onPress={() => void pay()}>
            {`Pay ${money(totalCents)}`}
          </Button>
        )}
        <Caption style={{ textAlign: "center" }}>
          Card, Apple Pay or Google Pay. Handled by Stripe — Atmos never sees
          your card details.
        </Caption>
      </View>
    </View>
  );
}

function msLeft(expiresAt: string | undefined): number {
  if (!expiresAt) return 0;
  const time = new Date(expiresAt).getTime();
  if (Number.isNaN(time)) return 0;
  return time - Date.now();
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  close: { color: colors.textSoft, fontSize: 26, lineHeight: 28 },
  hold: {
    padding: space.lg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.in,
    backgroundColor: colors.inDim,
    gap: 2,
  },
  holdExpired: { borderColor: colors.deny, backgroundColor: colors.denyDim },
  total: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: space.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  error: { padding: space.md, borderRadius: 6, backgroundColor: colors.denyDim },
  footer: {
    padding: space.lg,
    gap: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
