import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, space, stroke } from "@/lib/theme";
import {
  isAppleEducationAvailable,
  presentAppleHowToTap,
} from "@/lib/apple-education";
import { Body, Button, Caption, Eyebrow, Title } from "@/components/ui";
import { TapToPayMark } from "@/components/door/tap-to-pay-mark";

/**
 * Merchant education for Tap to Pay on iPhone.
 *
 * Two layers, and both are required rather than one being a nicety:
 *
 * - **4.1** on iOS 18 and later, Apple's own `ProximityReaderDiscovery` content
 *   must be presented. The checklist notes that doing so also fulfils 4.4, 4.6,
 *   4.7 and 4.8, because Apple keeps that content current and localised for the
 *   merchant's region.
 * - On iOS 17, that API does not exist, so the screens below are the *only*
 *   education those handsets get. They therefore have to stand on their own
 *   against **4.5** (contactless cards), **4.6** (Apple Pay and other wallets),
 *   **4.7** (PIN entry and its accessibility options — New Zealand supports PIN
 *   on iOS 16.4 and later, so this is not optional here) and **4.8** (the
 *   fallback when a card will not read).
 *
 * Reached automatically after the Terms and Conditions are accepted (**4.2**)
 * and permanently from the Tap to Pay hub (**4.3**).
 */
export default function TapToPayEducationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { after } = useLocalSearchParams<{ after?: string }>();
  const afterTerms = after === "terms";

  const [appleShown, setAppleShown] = useState(false);
  const appleAvailable = isAppleEducationAvailable();
  const autoPresented = useRef(false);

  const showApple = useCallback(async () => {
    const ok = await presentAppleHowToTap();
    setAppleShown(ok);
  }, []);

  /**
   * Straight after acceptance, Apple's content is the education — showing our
   * summary first and theirs second would bury the thing the requirement is
   * actually about. Elsewhere it stays a button, so somebody checking one
   * detail is not made to sit through the whole overlay.
   */
  useEffect(() => {
    if (!afterTerms || !appleAvailable || autoPresented.current) return;
    autoPresented.current = true;
    void showApple();
  }, [afterTerms, appleAvailable, showApple]);

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
          <Eyebrow>Taking payment</Eyebrow>
          <Title>How to use Tap to Pay on iPhone</Title>
        </View>

        {appleAvailable ? (
          <View style={{ gap: space.sm }}>
            <Button variant={afterTerms ? "outline" : "primary"} onPress={() => void showApple()}>
              {appleShown ? "Show Apple's guide again" : "Show Apple's guide"}
            </Button>
            <Caption>
              Apple's own walkthrough, kept up to date for New Zealand.
            </Caption>
          </View>
        ) : null}

        {/* 4.5 — accepting a contactless card. */}
        <Section
          step="1"
          title="Contactless cards"
          body="Enter the amount, then hold the customer's card flat against the top of this iPhone, just above the screen. Keep it there until the tick appears — a second or two after the first buzz. Visa, Mastercard and American Express all work."
        />

        {/* 4.6 — Apple Pay and other digital wallets. */}
        <Section
          step="2"
          title="Apple Pay and digital wallets"
          body="The same tap works for Apple Pay, Google Pay and Samsung Pay. The customer holds their iPhone, Apple Watch or Android phone to the top of this handset and confirms with Face ID, Touch ID or their own passcode. Watches need to be held closer than a card — right against the top edge."
        />

        {/*
          4.7 — PIN entry, and the accessibility options on Apple's PIN screen.
          Conditional on region, and New Zealand is a region where it applies:
          Tap to Pay on iPhone supports PIN on iOS 16.4 and later, and any
          contactless transaction over the local limit will ask for it.
        */}
        <Section
          step="3"
          title="If it asks for a PIN"
          body="Over the contactless limit, or when the card asks for it, Apple shows its own PIN screen. Hand the phone to the customer and let them enter it — you must not watch or enter it for them. The screen has its own accessibility options: the customer can turn on VoiceOver for a spoken, randomised keypad, and the keypad layout shuffles for privacy. Apple runs that screen; the PIN never reaches Atmos or this app."
        />

        {/*
          4.8 — the fallback when Tap to Pay cannot read the card. Required for
          regions that need one, and the app already has two.
        */}
        <Section
          step="4"
          title="If the card won't read"
          body="Some cards — particularly overseas ones that want to be inserted — will not go through contactlessly. Do not keep retrying. Ask for another card or a phone wallet, and if neither works, take cash or use the eftpos terminal and record the sale on the Sell screen as normal. Everyone gets a ticket either way."
        />

        <View style={styles.aside}>
          <TapToPayMark size={22} color={colors.textSoft} />
          <Caption style={{ flex: 1 }}>
            Nothing about the card is stored on this iPhone. Apple handles the
            read, Stripe handles the payment, and Atmos only ever sees the last
            four digits on the receipt.
          </Caption>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>
        {/*
          3.9 — once education is done, invite them to actually try it. The
          checklist calls this recommended; it is also the cleanest thing to put
          in the App Review recording.
        */}
        {afterTerms ? (
          <Button onPress={() => router.replace("/(door)/tap-to-pay/try-it")}>
            Try it out
          </Button>
        ) : (
          <Button variant="outline" onPress={() => router.back()}>
            Done
          </Button>
        )}
      </View>
    </View>
  );
}

function Section({
  step,
  title,
  body,
}: {
  step: string;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.step}>
        <Body style={{ fontWeight: "900" }}>{step}</Body>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: space.xs }}>
        <Body style={{ fontWeight: "700" }}>{title}</Body>
        <Body soft>{body}</Body>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    flexDirection: "row",
    gap: space.md,
    padding: space.lg,
    backgroundColor: colors.surface,
    borderWidth: stroke.hair,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  step: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: stroke.hard,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
  },
  aside: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
  },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    backgroundColor: colors.bg,
    borderTopWidth: stroke.hard,
    borderTopColor: colors.border,
  },
});
