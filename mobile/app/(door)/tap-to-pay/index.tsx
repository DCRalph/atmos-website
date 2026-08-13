import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronRight } from "lucide-react-native";

import { API_URL } from "@/lib/env";
import { colors, radius, space, stroke } from "@/lib/theme";
import { useTapToPay } from "@/lib/tap-to-pay";
import { Body, Button, Caption, Eyebrow, Title } from "@/components/ui";
import { TapToPayStateView } from "@/components/door/tap-to-pay-state";

/**
 * The Tap to Pay on iPhone hub.
 *
 * This one screen carries four separate App Review requirements, and they are
 * why it exists at all rather than the feature living only inside checkout:
 *
 * - **3.1** highly visible, easily discoverable communication about Tap to Pay.
 * - **3.6** the merchant must be able to *enable* Tap to Pay outside the usual
 *   communications and checkout flow — i.e. from settings, which is here.
 * - **3.8 / 3.8.1** only an authorized party may accept the Terms and
 *   Conditions, and everybody else must be told to find one.
 * - **4.3** merchant education must stay reachable for later reference.
 */
export default function TapToPayHubScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state, acceptTerms, retry, justAcceptedTerms, acknowledgeAcceptance } =
    useTapToPay();
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Checklist 4.2: education must follow acceptance. Doing it here, off the
   * SDK's own acceptance callback, means it happens however the terms came to
   * be accepted — from this screen, or from the checkout trigger in 5.3.
   */
  useEffect(() => {
    if (!justAcceptedTerms) return;
    acknowledgeAcceptance();
    // Object form, as everywhere else here: `typedRoutes` is on, and a query
    // string baked into the path is not something it will accept.
    router.push({
      pathname: "/(door)/tap-to-pay/education",
      params: { after: "terms" },
    });
  }, [justAcceptedTerms, acknowledgeAcceptance, router]);

  const onSetUp = useCallback(async () => {
    setError(null);
    setAccepting(true);
    try {
      await acceptTerms();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Couldn't start setup.",
      );
    } finally {
      setAccepting(false);
    }
  }, [acceptTerms]);

  const canSetUp = state.status === "needs-setup" && state.canAccept;

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
          <Eyebrow>Door tools</Eyebrow>
          {/* The full product name, every time it is written. Apple's Developer
              Marketing Guidelines (checklist 1.9) do not allow it shortened. */}
          <Title>Tap to Pay on iPhone</Title>
        </View>

        <TapToPayStateView state={state} />

        {error ? (
          <View style={styles.error}>
            <Caption style={{ color: colors.deny }}>{error}</Caption>
          </View>
        ) : null}

        {/* 3.6 — the enable action, outside checkout. */}
        {canSetUp ? (
          <View style={{ gap: space.sm }}>
            <Button loading={accepting} onPress={() => void onSetUp()}>
              Set up Tap to Pay on iPhone
            </Button>
            <Caption>
              Apple will ask you to accept the Tap to Pay on iPhone Terms and
              Conditions. They are accepted against your Apple Account and apply
              to this handset.
            </Caption>
          </View>
        ) : null}

        {state.status === "error" ? (
          <Button variant="outline" onPress={retry}>
            Try again
          </Button>
        ) : null}

        {/*
          Checklist 2.1 — a new user must be able to discover how to get to Tap
          to Pay. Atmos is a single merchant and nobody signs up to become one
          through the app, so what is discoverable is the truth: this is Atmos
          box-office tooling, and here is how to ask for it.
        */}
        {state.status === "ineligible" ? (
          <View style={{ gap: space.sm }}>
            <View style={styles.blurb}>
              <Body soft>
                Tap to Pay on iPhone is used by Atmos staff working the door at
                our own events. Access is granted per event by an Atmos
                organiser — there is nothing to sign up for.
              </Body>
              <Caption style={{ marginTop: space.md }}>
                If you are working a door and cannot see it here, ask the
                organiser to add you to that event's door staff.
              </Caption>
            </View>
            <Button
              variant="outline"
              onPress={() =>
                void WebBrowser.openBrowserAsync(`${API_URL}/contact`, {
                  presentationStyle:
                    WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
                  controlsColor: colors.text,
                  toolbarColor: colors.bg,
                })
              }
            >
              Contact Atmos
            </Button>
          </View>
        ) : null}

        {/* 4.3 — education, permanently reachable, not just after onboarding. */}
        <View style={{ gap: space.sm }}>
          <Eyebrow>How it works</Eyebrow>
          <Row
            label="How to take a payment"
            detail="Cards, Apple Pay, PIN entry and what to do when a card won't read"
            onPress={() => router.push("/(door)/tap-to-pay/education")}
          />
          {state.status === "ready" ? (
            <Row
              label="Take a test payment"
              detail="Charge yourself a dollar to see the whole flow"
              onPress={() => router.push("/(door)/tap-to-pay/try-it")}
            />
          ) : null}
        </View>

        <View style={{ gap: space.sm }}>
          <Eyebrow>What it is</Eyebrow>
          <View style={styles.blurb}>
            <Body soft>
              Tap to Pay on iPhone turns this handset into the card reader. There
              is no extra hardware to carry, charge or lose — customers hold
              their card, iPhone or Apple Watch to the top of the phone and the
              payment goes straight onto the Atmos Stripe account.
            </Body>
            <Caption style={{ marginTop: space.md }}>
              Needs an iPhone XS or later. Cash and eftpos stay available at
              every door regardless.
            </Caption>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>
        <Button variant="outline" onPress={() => router.back()}>
          Done
        </Button>
      </View>
    </View>
  );
}

function Row({
  label,
  detail,
  onPress,
}: {
  label: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Body style={{ fontWeight: "600" }}>{label}</Body>
        <Caption>{detail}</Caption>
      </View>
      <ChevronRight color={colors.textFaint} size={16} strokeWidth={2.5} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    backgroundColor: colors.surface,
    borderWidth: stroke.hair,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  blurb: {
    padding: space.lg,
    backgroundColor: colors.surface,
    borderWidth: stroke.hair,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
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
