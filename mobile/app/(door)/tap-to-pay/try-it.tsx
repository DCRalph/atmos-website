import { useCallback, useRef, useState } from "react";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useStripeTerminal } from "@stripe/stripe-terminal-react-native";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/lib/api";
import { colors, radius, space, stroke } from "@/lib/theme";
import { useTapToPay } from "@/lib/tap-to-pay";
import { Body, Button, Caption, Eyebrow, Loading, Title } from "@/components/ui";
import { TapToPayMark } from "@/components/door/tap-to-pay-mark";
import { TapToPayStateView } from "@/components/door/tap-to-pay-state";

type Stage = "idle" | "opening" | "waiting-for-tap" | "processing" | "done" | "failed";

/**
 * "Now try it."
 *
 * Checklist 3.9: after the Terms and Conditions are accepted and the education
 * is done, present a dedicated screen inviting the merchant to try Tap to Pay.
 *
 * The tap is real — a real card, read by Apple, authorised by Stripe — but the
 * dollar is authorised and immediately voided, so a staffer can prove a new
 * handset works on their own card without being out of pocket. A pretend
 * button would not tell anybody whether this phone actually works, which is the
 * only question worth answering before a door opens.
 *
 * Deliberately separate from the sell sheet. That path mints tickets only after
 * the server has re-read the intent from Stripe, and nothing about a practice
 * run should be able to reach it.
 */
export default function TapToPayTryItScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state, isReady } = useTapToPay();

  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const intentRef = useRef<string | null>(null);

  const { retrievePaymentIntent, collectPaymentMethod, confirmPaymentIntent } =
    useStripeTerminal();
  const createTest = api.terminal.createTestIntent.useMutation();
  const voidTest = api.terminal.voidTestIntent.useMutation();

  const run = useCallback(async () => {
    setError(null);
    try {
      setStage("opening");
      const test = await createTest.mutateAsync();
      intentRef.current = test.paymentIntentId;
      if (!test.clientSecret) throw new Error("Couldn't open a test payment.");

      const { paymentIntent, error: retrieveError } =
        await retrievePaymentIntent(test.clientSecret);
      if (retrieveError || !paymentIntent) {
        throw new Error(retrieveError?.message ?? "Couldn't open a test payment.");
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
      if (confirmError) throw new Error(confirmError.message);

      // Release it straight away. The authorisation existing for a couple of
      // seconds is the point; keeping it is not.
      await voidTest.mutateAsync({ paymentIntentId: test.paymentIntentId });
      intentRef.current = null;

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStage("done");
    } catch (cause) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // Void whatever was opened, even on the way out — an abandoned
      // authorisation on somebody's card is a bad way to end a practice run.
      if (intentRef.current) {
        voidTest.mutate({ paymentIntentId: intentRef.current });
        intentRef.current = null;
      }
      setError(cause instanceof Error ? cause.message : "That didn't go through.");
      setStage("failed");
    }
  }, [
    createTest,
    voidTest,
    retrievePaymentIntent,
    collectPaymentMethod,
    confirmPaymentIntent,
  ]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space.lg,
          paddingBottom: insets.bottom + space.xxl,
          paddingHorizontal: space.lg,
          gap: space.xl,
        }}
      >
        <View style={{ gap: space.xs }}>
          <Eyebrow>You're set up</Eyebrow>
          <Title>Try Tap to Pay on iPhone</Title>
        </View>

        {!isReady ? (
          <TapToPayStateView state={state} />
        ) : (
          <View style={styles.hero}>
            <TapToPayMark size={44} color={colors.text} />
            <Body style={{ textAlign: "center", fontWeight: "700" }}>
              Take a $1 test payment
            </Body>
            <Caption style={{ textAlign: "center" }}>
              Use your own card. The dollar is authorised to prove the reader
              works and released immediately — nothing is ever charged, and it
              may show as a pending line for a few minutes.
            </Caption>
          </View>
        )}

        {stage === "waiting-for-tap" ? (
          <View style={styles.prompt}>
            <Body style={styles.big}>Hold card to phone</Body>
            <Caption style={{ textAlign: "center" }}>
              Card, Apple Pay or Google Pay — near the top edge.
            </Caption>
          </View>
        ) : null}

        {stage === "opening" || stage === "processing" ? (
          <Loading label={stage === "opening" ? "Opening" : "Checking the card"} />
        ) : null}

        {stage === "done" ? (
          <View style={styles.prompt}>
            <Body style={[styles.big, { color: colors.in }]}>
              That worked
            </Body>
            <Caption style={{ textAlign: "center" }}>
              This iPhone is ready to take payments at a door. The dollar has
              been released.
            </Caption>
          </View>
        ) : null}

        {error ? (
          <View style={styles.error}>
            <Caption style={{ color: colors.deny }}>{error}</Caption>
          </View>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + space.lg, gap: space.sm },
        ]}
      >
        {isReady && stage !== "done" ? (
          <Button
            loading={stage === "opening" || stage === "processing"}
            onPress={() => void run()}
          >
            {stage === "failed" ? "Try again" : "Take a $1 test payment"}
          </Button>
        ) : null}
        <Button
          variant="outline"
          disabled={stage === "waiting-for-tap" || stage === "processing"}
          onPress={() => router.replace("/(door)")}
        >
          {stage === "done" ? "Go to the door" : "Skip for now"}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    gap: space.md,
    padding: space.xl,
    backgroundColor: colors.surface,
    borderWidth: stroke.hard,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  prompt: { alignItems: "center", gap: space.sm },
  big: { fontSize: 26, fontWeight: "800", textAlign: "center" },
  error: {
    padding: space.md,
    borderRadius: radius.sm,
    backgroundColor: colors.denyDim,
  },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    backgroundColor: colors.bg,
    borderTopWidth: stroke.hard,
    borderTopColor: colors.border,
  },
});
