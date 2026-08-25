import { useCallback, useEffect, useRef, useState } from "react";
import { CollectionMode, useStripe } from "@stripe/stripe-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";

import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors, radius, space, stroke } from "@/lib/theme";
import { formatCountdown } from "@/lib/dates";
import { Body, Button, Caption, Loading, Notice, Title } from "@/components/ui";

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/**
 * Pay.
 *
 * Three things the web checkout never had to handle. The hold is shown as a
 * countdown, because a reservation that expires invisibly is a reservation
 * that turns into a confusing error. The stock is released when the screen is
 * abandoned — people put a phone in a pocket mid-purchase far more often than
 * they close a browser tab, and every one of those would otherwise sit on held
 * stock until it timed out. And a free order never reaches Stripe at all: it is
 * claimed, which is a different endpoint and a different button.
 */
export default function PayScreen() {
  const {
    slug,
    orderId,
    token,
    clientSecret,
    total,
    expiresAt,
    free,
    needsDetails,
  } = useLocalSearchParams<{
    slug: string;
    orderId: string;
    token: string;
    clientSecret: string;
    total: string;
    expiresAt: string;
    /** "1" when the basket came to nothing — see `ticketCheckout.start`. */
    free: string;
    /** "1" when a tier in the basket has to know who is claiming it. */
    needsDetails: string;
  }>();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const isFree = free === "1";
  const mustAskDetails = isFree && needsDetails === "1";

  const [ready, setReady] = useState(isFree);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [remaining, setRemaining] = useState(() => msLeft(expiresAt));
  const [email, setEmail] = useState(user?.email ?? "");
  const [name, setName] = useState(user?.name ?? "");
  /** A gated free tier can end in a queue rather than a ticket. */
  const [approval, setApproval] = useState(false);

  /**
   * Set once the order is paid, and while the payment sheet is up.
   *
   * The second case is the one that is easy to miss. A 3D Secure challenge
   * hands off to the bank's app or to Safari, which backgrounds Atmos — and
   * without this the listener below would read that as abandonment, give the
   * stock back and navigate away from a payment that was still in progress.
   */
  const settled = useRef(false);

  const confirm = api.ticketCheckout.confirm.useMutation();
  const claimFree = api.ticketCheckout.claimFree.useMutation();
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
    if (isFree) return;

    let cancelled = false;
    void (async () => {
      if (!clientSecret) {
        setError("That order didn't open a payment. Start again.");
        return;
      }
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: "Atmos",
        paymentIntentClientSecret: clientSecret,
        applePay: { merchantCountryCode: "NZ" },
        googlePay: { merchantCountryCode: "NZ", testEnv: __DEV__ },
        style: "alwaysDark",
        returnURL: "atmos://checkout",
        /**
         * Collect an email, always.
         *
         * Without this Stripe asks for a card and nothing else, the charge
         * carries no billing email, and `confirm` has nowhere to send the
         * ticket — which would leave somebody who bought signed out with a
         * ticket they can only reach from the handset they bought it on.
         */
        billingDetailsCollectionConfiguration: {
          email: CollectionMode.ALWAYS,
          name: CollectionMode.ALWAYS,
          // Prefilled values are only prefill unless this says otherwise, and
          // the whole point is that the charge carries them.
          attachDefaultsToPaymentMethod: true,
        },
        defaultBillingDetails: {
          email: user?.email,
          name: user?.name,
        },
      });
      if (cancelled) return;
      if (initError) setError(initError.message);
      else setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientSecret, initPaymentSheet, isFree, user?.email, user?.name]);

  const finish = useCallback(() => {
    settled.current = true;
    void utils.tickets.mine.invalidate();
    router.replace({
      pathname: "/(checkout)/[slug]/done",
      params: { slug, token },
    });
  }, [router, slug, token, utils]);

  const pay = useCallback(async () => {
    setPaying(true);
    setError(null);
    // The sheet can hand off to a bank app; that is not abandonment.
    settled.current = true;
    try {
      const { error: sheetError } = await presentPaymentSheet();
      if (sheetError) {
        settled.current = false;
        // Cancelling is not an error worth shouting about.
        if (sheetError.code !== "Canceled") setError(sheetError.message);
        return;
      }

      // The webhook usually issues first; this makes the app independent of it.
      const result = await confirm.mutateAsync({ accessToken: token });
      if (result.status !== "PAID") {
        setError(
          "Payment went through but tickets are still issuing. Check your email in a moment.",
        );
        return;
      }

      finish();
    } catch (cause) {
      settled.current = false;
      setError(
        cause instanceof Error ? cause.message : "That payment didn't complete.",
      );
    } finally {
      setPaying(false);
    }
  }, [presentPaymentSheet, confirm, token, finish]);

  /** A free order is claimed, not paid for. Different endpoint, no Stripe. */
  const claim = useCallback(async () => {
    setPaying(true);
    setError(null);
    try {
      const result = await claimFree.mutateAsync({
        accessToken: token,
        ...(mustAskDetails
          ? { email: email.trim(), name: name.trim() || undefined }
          : {}),
      });

      if ("awaitingApproval" in result && result.awaitingApproval) {
        // Nothing is issued yet, but the hold is gone and the request stands,
        // so this must not be released on the way out.
        settled.current = true;
        setError(null);
        setApproval(true);
        return;
      }

      finish();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "That didn't go through.",
      );
    } finally {
      setPaying(false);
    }
  }, [claimFree, token, mustAskDetails, email, name, finish]);

  // An order awaiting approval has no hold, so it has no countdown either.
  const hasHold = Number.isFinite(remaining);
  const expired = hasHold && remaining <= 0;
  const canClaim = !mustAskDetails || /.+@.+\..+/.test(email.trim());

  if (approval) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: space.lg, justifyContent: "center" }}>
        <Notice
          title="Request in"
          detail={`We'll email ${email.trim()} once it's approved. Nothing is issued until then.`}
          action={
            <Button onPress={() => router.replace("/(tabs)/gigs")}>Done</Button>
          }
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft color={colors.text} size={22} strokeWidth={2.5} />
        </Pressable>
        <Title style={{ fontSize: 18 }}>{isFree ? "Claim" : "Payment"}</Title>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: space.lg, gap: space.lg }}
        keyboardShouldPersistTaps="handled"
      >
        {hasHold ? (
          <View style={[styles.hold, expired && styles.holdExpired]}>
            <Body style={{ fontWeight: "700" }}>
              {expired
                ? "Hold expired"
                : `Held for ${formatCountdown(remaining)}`}
            </Body>
            <Caption>
              {expired
                ? "Those tickets went back on sale. Start again to pick them up."
                : "Your tickets are reserved until the timer runs out."}
            </Caption>
          </View>
        ) : null}

        <View style={styles.total}>
          <Body style={{ fontWeight: "700" }}>Total</Body>
          <Body style={{ fontWeight: "700" }}>
            {totalCents === 0 ? "Free" : money(totalCents)}
          </Body>
        </View>

        {mustAskDetails ? (
          <View style={{ gap: space.md }}>
            <Caption>
              This ticket is issued to a person, so it needs a name and an email
              to send it to.
            </Caption>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
            />
            <Field
              label="Name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              textContentType="name"
            />
          </View>
        ) : null}

        {error ? (
          <View style={styles.error}>
            <Caption style={{ color: colors.deny }}>{error}</Caption>
          </View>
        ) : null}

        {!ready && !error ? <Loading label="Preparing payment" /> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>
        {expired ? (
          <Button
            onPress={() =>
              router.replace({
                pathname: "/(checkout)/[slug]/tiers",
                params: { slug },
              })
            }
          >
            Start again
          </Button>
        ) : isFree ? (
          <Button
            disabled={!canClaim}
            loading={paying}
            onPress={() => void claim()}
          >
            Get my ticket
          </Button>
        ) : (
          <Button disabled={!ready} loading={paying} onPress={() => void pay()}>
            {`Pay ${money(totalCents)}`}
          </Button>
        )}
        <Caption style={{ textAlign: "center" }}>
          {isFree
            ? "Nothing to pay. Your ticket appears in the app straight away."
            : "Card, Apple Pay or Google Pay. Handled by Stripe — Atmos never sees your card details."}
        </Caption>
      </View>
    </View>
  );
}

function Field({
  label,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={{ gap: space.xs }}>
      <Caption>{label}</Caption>
      <TextInput
        {...props}
        placeholderTextColor={colors.textFaint}
        style={styles.input}
      />
    </View>
  );
}

/**
 * Sentinel for "this order has no hold on it".
 *
 * An order awaiting approval has `expiresAt: null`, and treating a missing
 * expiry as "expired at the epoch" is what used to make that screen open on a
 * dead **Start again** button with no way to finish.
 */
const NO_EXPIRY = Number.POSITIVE_INFINITY;

function msLeft(expiresAt: string | undefined): number {
  if (!expiresAt) return NO_EXPIRY;
  const time = new Date(expiresAt).getTime();
  if (Number.isNaN(time)) return NO_EXPIRY;
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
  hold: {
    padding: space.lg,
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
  input: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: stroke.hair,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
    color: colors.text,
    fontSize: 16,
  },
  error: { padding: space.md, backgroundColor: colors.denyDim },
  footer: {
    padding: space.lg,
    gap: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
