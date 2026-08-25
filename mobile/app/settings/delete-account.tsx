import { useState } from "react";
import { useRouter } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";

import { api } from "@/lib/api";
import { API_URL } from "@/lib/env";
import { authClient, signOut, useAuth } from "@/lib/auth";
import { clearRegisteredPushToken, getRegisteredPushToken } from "@/lib/push";
import { colors, radius, space, stroke } from "@/lib/theme";
import { Body, Button, Caption, Eyebrow, Notice, Title } from "@/components/ui";

/** Typed in full, so this cannot happen by fat finger on a night out. */
const CONFIRMATION = "DELETE";

/**
 * Delete my account.
 *
 * App Store Guideline 5.1.1(v): an app that lets somebody make an account has
 * to let them destroy one from inside it, without emailing support.
 *
 * Two things it is careful about. It says plainly what survives — tickets keep
 * working and the orders behind them stay on the books, because they are sales
 * records — rather than implying a clean slate it cannot deliver. And it
 * confirms by email, which is what makes it work for an Apple or Google account
 * with no password to re-enter. See `user.deleteUser` in `src/server/auth.ts`.
 */
export default function DeleteAccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unregister = api.push.unregister.useMutation();

  const request = async () => {
    setPending(true);
    setError(null);
    try {
      const result = await authClient.deleteUser({
        callbackURL: `${API_URL}/account-deleted`,
      });
      if (result.error) {
        setError(result.error.message ?? "That didn't work. Try again.");
        return;
      }

      // The handset should stop hearing about this account the moment deletion
      // is in motion, not whenever the app next launches.
      const token = getRegisteredPushToken();
      if (token) unregister.mutate({ token });
      clearRegisteredPushToken();

      setSent(true);
    } catch {
      setError("Couldn't reach Atmos. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + space.lg,
        paddingBottom: space.xxl,
        paddingHorizontal: space.lg,
        gap: space.lg,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft color={colors.text} size={22} strokeWidth={2.5} />
        </Pressable>
        <Title>Delete account</Title>
      </View>

      {sent ? (
        <>
          <Notice
            title="Check your email"
            detail={`We've sent a confirmation link to ${user?.email ?? "your address"}. Your account is deleted when you open it, and not before.`}
          />
          <Button
            onPress={() => {
              void signOut();
              router.replace("/(tabs)");
            }}
          >
            Sign out on this phone
          </Button>
          <Button variant="outline" onPress={() => router.back()}>
            I&apos;ve changed my mind
          </Button>
        </>
      ) : (
        <>
          <View style={styles.panel}>
            <Eyebrow>What goes</Eyebrow>
            <Body soft style={styles.line}>
              Your name, your email address and any phone number on your orders.
              Your newsletter subscription. Every device signed in to this
              account.
            </Body>
          </View>

          <View style={styles.panel}>
            <Eyebrow>What stays</Eyebrow>
            <Body soft style={styles.line}>
              Tickets you have already bought keep working at the door — use the
              QR code in your confirmation email or your wallet pass. The orders
              behind them stay on our books with your details stripped off,
              because we are required to keep sales records.
            </Body>
          </View>

          <View style={{ gap: space.xs }}>
            <Caption>Type {CONFIRMATION} to confirm</Caption>
            <TextInput
              value={typed}
              onChangeText={setTyped}
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.input}
            />
          </View>

          {error ? (
            <View style={styles.error}>
              <Caption style={{ color: colors.deny }}>{error}</Caption>
            </View>
          ) : null}

          <Button
            disabled={typed.trim().toUpperCase() !== CONFIRMATION}
            loading={pending}
            onPress={() => void request()}
          >
            Delete my account
          </Button>

          <Caption style={{ textAlign: "center" }}>
            We&apos;ll email you a link to confirm. Nothing is deleted until you
            open it.
          </Caption>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: space.md },
  panel: {
    gap: space.xs,
    padding: space.lg,
    backgroundColor: colors.surface,
    borderWidth: stroke.hair,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  line: { lineHeight: 21 },
  input: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: stroke.hard,
    borderColor: colors.deny,
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
    color: colors.text,
    fontSize: 16,
    letterSpacing: 2,
  },
  error: {
    padding: space.md,
    borderRadius: radius.sm,
    backgroundColor: colors.denyDim,
  },
});
