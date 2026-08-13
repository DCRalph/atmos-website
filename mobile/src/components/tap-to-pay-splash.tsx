import { useCallback, useState } from "react";
import { useRouter } from "expo-router";
import { Modal, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors, radius, space, stroke } from "@/lib/theme";
import { Body, Button, Caption, Eyebrow, Title } from "@/components/ui";
import { TapToPayMark } from "@/components/door/tap-to-pay-mark";

/**
 * The Tap to Pay on iPhone launch splash.
 *
 * Apple's App Review checklist 3.2 (recommended) and **6.2 (required)**: at
 * launch, a full-screen in-app splash must be shown to every eligible user at
 * least once, built from the 'Hero' in-app banner in the Tap to Pay on iPhone
 * Marketing Guide.
 *
 * Whether it has been seen is a server fact, not a device one — see
 * `tapToPay.markSplashSeen`. A door runs on shared handsets that get reinstalled
 * and handed around, and "once per install" would mean both showing it to
 * people who have seen it and never showing it to people who have not.
 *
 * ---
 *
 * ⚠️ **The artwork and copy here are placeholders.**
 *
 * The layout is right and the plumbing is finished, but rows 1.9 and 6.2 are
 * checked against Apple's approved assets. Drop the Hero banner in as
 * `assets/tap-to-pay-hero.png`, uncomment the `<Image>` below, and replace the
 * headline and body with the Marketing Guide's copy before submitting.
 */
export function TapToPaySplash() {
  const { user } = useAuth();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  // `doorProcedure` on the server, so this is refused for anybody who is not
  // door staff — a punter never sees the splash and never asks twice.
  const announcement = api.tapToPay.announcement.useQuery(undefined, {
    enabled: !!user,
    retry: false,
    staleTime: 60 * 60 * 1000,
  });
  const markSeen = api.tapToPay.markSplashSeen.useMutation();

  const close = useCallback(
    (then?: () => void) => {
      setDismissed(true);
      // Recorded on dismissal rather than on mount: a splash that was drawn
      // while the phone was in somebody's pocket has not been seen.
      markSeen.mutate();
      then?.();
    },
    [markSeen],
  );

  const visible = !dismissed && announcement.data?.showSplash === true;
  if (!visible) return null;

  return (
    <Modal visible animationType="fade" transparent={false}>
      <SplashBody
        onLearnMore={() => close(() => router.push("/(door)/tap-to-pay"))}
        onDismiss={() => close()}
      />
    </Modal>
  );
}

function SplashBody({
  onLearnMore,
  onDismiss,
}: {
  onLearnMore: () => void;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <ScrollView contentContainerStyle={styles.body}>
        {/*
          PLACEHOLDER for the Marketing Guide's 'Hero' in-app banner. Replace
          this block with:

            <Image
              source={require("../../assets/tap-to-pay-hero.png")}
              style={{ width: "100%", height: 220 }}
              contentFit="contain"
            />
        */}
        <View style={styles.hero}>
          <TapToPayMark size={72} color={colors.text} />
        </View>

        <View style={{ gap: space.sm, alignItems: "center" }}>
          <Eyebrow>New in Atmos</Eyebrow>
          <Title style={{ textAlign: "center" }}>Tap to Pay on iPhone</Title>
          <Body soft style={{ textAlign: "center" }}>
            Accept contactless cards, Apple Pay and other digital wallets at the
            door — on the iPhone you already carry. No extra reader to charge or
            lose.
          </Body>
        </View>

        <View style={styles.points}>
          <Point text="Customers tap their card, phone or watch to the top of your iPhone." />
          <Point text="Money goes straight onto the Atmos Stripe account, like any other sale." />
          <Point text="Cash and eftpos stay exactly as they are." />
        </View>

        <Caption style={{ textAlign: "center" }}>
          Needs an iPhone XS or later.
        </Caption>
      </ScrollView>

      <View style={styles.actions}>
        <Button onPress={onLearnMore}>Set it up</Button>
        <Button variant="outline" onPress={onDismiss}>
          Not now
        </Button>
      </View>
    </View>
  );
}

function Point({ text }: { text: string }) {
  return (
    <View style={styles.point}>
      <TapToPayMark size={16} color={colors.textFaint} filled={false} />
      <Body soft style={{ flex: 1 }}>
        {text}
      </Body>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: {
    flexGrow: 1,
    justifyContent: "center",
    padding: space.xl,
    gap: space.xl,
  },
  hero: {
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: stroke.hard,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  points: { gap: space.md },
  point: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  actions: {
    padding: space.lg,
    paddingBottom: space.xl,
    gap: space.sm,
    borderTopWidth: stroke.hard,
    borderTopColor: colors.border,
  },
});
