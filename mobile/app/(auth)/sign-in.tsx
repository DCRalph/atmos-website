import { useState } from "react";
import { useRouter } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { authClient, signIn, signUp } from "@/lib/auth";
import { API_URL } from "@/lib/env";
import { colors, radius, space, stroke } from "@/lib/theme";
import { Body, Button, Caption, Eyebrow, Title } from "@/components/ui";
import { GoogleMark } from "@/components/google-mark";

type Mode = "sign-in" | "sign-up";

/**
 * Sign in.
 *
 * Deliberately skippable: almost everything in the app works signed out, and
 * the only thing behind this door is keeping tickets. Nobody should have to
 * make an account to look at a gig listing.
 */
export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      const result =
        mode === "sign-in"
          ? await signIn.email({ email: email.trim(), password })
          : await signUp.email({
              email: email.trim(),
              password,
              name: name.trim() || email.trim(),
            });

      if (result.error) {
        setError(result.error.message ?? "That didn't work. Try again.");
        return;
      }
      leave();
    } catch {
      setError("Couldn't reach Atmos. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  };

  /**
   * Sign in with Apple, natively.
   *
   * App Store Guideline 4.8: the screen offers Google, so it has to offer an
   * equivalent privacy-preserving login too. Apple's own sheet rather than a
   * browser round trip, which is what makes it the fastest way in on iOS.
   *
   * The nonce is generated here, handed to Apple, and sent on to the server
   * with the identity token so it can be checked against the token's `nonce`
   * claim. Without it a token captured once could be replayed within its hour.
   *
   * Name and email arrive **only on the very first authorisation** for a given
   * Apple ID; every sign-in afterwards has them null. So they are passed
   * straight through to better-auth, which is where the account gets created.
   */
  const apple = async () => {
    setPending(true);
    setError(null);
    try {
      const nonce = Crypto.randomUUID();
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce,
      });

      if (!credential.identityToken) {
        setError("Apple didn't return a sign-in token. Try again.");
        return;
      }

      const result = await signIn.social({
        provider: "apple",
        idToken: {
          token: credential.identityToken,
          nonce,
          user: {
            email: credential.email ?? undefined,
            name: credential.fullName
              ? {
                  firstName: credential.fullName.givenName ?? undefined,
                  lastName: credential.fullName.familyName ?? undefined,
                }
              : undefined,
          },
        },
      });

      if (result.error) {
        setError(result.error.message ?? "Couldn't finish signing in.");
        return;
      }
      leave();
    } catch (cause) {
      // Tapping Cancel on Apple's sheet is a decision, not a failure.
      if (
        cause instanceof Error &&
        "code" in cause &&
        cause.code === "ERR_REQUEST_CANCELED"
      ) {
        return;
      }
      setError("Couldn't finish signing in with Apple.");
    } finally {
      setPending(false);
    }
  };

  const google = async () => {
    setPending(true);
    setError(null);
    try {
      // Opens the system browser and returns through the app's scheme, which
      // is why that scheme has to be in the server's trustedOrigins.
      await signIn.social({ provider: "google", callbackURL: "/" });
      leave();
    } catch {
      setError("Couldn't finish signing in with Google.");
    } finally {
      setPending(false);
    }
  };

  /**
   * Forgotten password.
   *
   * The link lands on the website rather than back in the app: a reset has to
   * work from the mail app on a handset, and the server answers the same way
   * whether or not the address exists, so this always reports "sent".
   */
  const resetPassword = async () => {
    const address = email.trim();
    if (!address) {
      setError("Put your email in first, then tap this again.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await authClient.requestPasswordReset({
        email: address,
        redirectTo: `${API_URL}/reset-password`,
      });
      setResetSent(true);
    } catch {
      setError("Couldn't reach Atmos. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  };

  /**
   * Get out of the way once they are in.
   *
   * `router.back()` alone is wrong when this screen is the first thing on the
   * stack, which is what a deep link or a notification tap produces — there is
   * nothing behind it to go back to.
   */
  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          padding: space.lg,
          paddingTop: insets.top + space.xl,
          gap: space.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: space.xs }}>
          <Eyebrow>{mode === "sign-in" ? "Welcome back" : "Join"}</Eyebrow>
          <Title>{mode === "sign-in" ? "Sign in" : "Create an account"}</Title>
          <Caption>
            Keeps your tickets in one place. Everything else works without it.
          </Caption>
        </View>

        {Platform.OS === "ios" ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={
              mode === "sign-in"
                ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                : AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
            }
            // The app is dark, so the white button is the one that reads.
            buttonStyle={
              AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
            }
            cornerRadius={radius.md}
            style={{ height: 48 }}
            onPress={() => void apple()}
          />
        ) : null}

        <GoogleButton onPress={google} disabled={pending} />

        <View style={styles.divider}>
          <View style={styles.rule} />
          <Caption>or</Caption>
          <View style={styles.rule} />
        </View>

        {mode === "sign-up" && (
          <Field
            label="Name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            textContentType="name"
          />
        )}

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
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          // `newPassword` on sign-up is what makes iOS offer to generate and
          // save a strong one instead of asking somebody to invent it.
          textContentType={mode === "sign-up" ? "newPassword" : "password"}
        />

        {error ? (
          <View style={styles.error}>
            <Caption style={{ color: colors.deny }}>{error}</Caption>
          </View>
        ) : null}

        {resetSent ? (
          <View style={styles.notice}>
            <Caption>
              If that address has an Atmos account, a reset link is on its way to
              it. Open it, choose a new password, then come back and sign in.
            </Caption>
          </View>
        ) : null}

        <Button onPress={submit} loading={pending}>
          {mode === "sign-in" ? "Sign in" : "Create account"}
        </Button>

        {mode === "sign-in" ? (
          <Pressable onPress={() => void resetPassword()} hitSlop={8}>
            <Caption style={{ textAlign: "center" }}>
              Forgotten your password?
            </Caption>
          </Pressable>
        ) : (
          // Where a new account agrees to something, it has to be able to read
          // it first.
          <Caption style={{ textAlign: "center" }}>
            Creating an account means you accept the{" "}
            <Caption style={styles.link} onPress={() => openWeb("/terms")}>
              terms
            </Caption>{" "}
            and{" "}
            <Caption style={styles.link} onPress={() => openWeb("/privacy")}>
              privacy policy
            </Caption>
            .
          </Caption>
        )}

        <Pressable
          onPress={() => {
            setMode(mode === "sign-in" ? "sign-up" : "sign-in");
            setError(null);
            setResetSent(false);
          }}
          hitSlop={8}
        >
          <Caption style={{ textAlign: "center" }}>
            {mode === "sign-in"
              ? "No account? Create one"
              : "Already have an account? Sign in"}
          </Caption>
        </Pressable>

        <Pressable onPress={leave} hitSlop={8}>
          <Body soft style={{ textAlign: "center" }}>
            Not now
          </Body>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function openWeb(path: string) {
  void WebBrowser.openBrowserAsync(`${API_URL}${path}`, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    controlsColor: colors.text,
    toolbarColor: colors.bg,
  });
}

/**
 * Sign in with Google.
 *
 * Its own button rather than the shared one, because that one puts its label
 * through `textTransform: uppercase` and cannot hold anything but text. Google
 * asks for the mark and the phrase as written, so "CONTINUE WITH GOOGLE" with
 * no logo was wrong twice over.
 *
 * Still not fully to spec: the colours and the typeface are the app's, where
 * Google names a theme palette and Google Sans Medium. Those are the remaining
 * gaps.
 */
function GoogleButton({
  onPress,
  disabled,
}: {
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.google,
        pressed && !disabled && { opacity: 0.7 },
        disabled && { opacity: 0.45 },
      ]}
    >
      <GoogleMark size={20} />
      <Body style={styles.googleLabel}>Continue with Google</Body>
    </Pressable>
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

const styles = StyleSheet.create({
  input: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
    color: colors.text,
    fontSize: 16,
  },
  google: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: stroke.hard,
    borderColor: colors.borderHard,
    flexDirection: "row",
    alignItems: "center",
    // Google's iOS padding: 16 before the mark, 12 after it, 16 at the end.
    paddingLeft: 16,
    paddingRight: 16,
  },
  googleLabel: {
    flex: 1,
    textAlign: "center",
    marginLeft: 12,
    // Deliberately not the shared button label: that one is uppercase, 900 and
    // letterspaced, and the phrase has to read as Google wrote it.
    fontWeight: "500",
  },
  link: { color: colors.text, textDecorationLine: "underline" },
  divider: { flexDirection: "row", alignItems: "center", gap: space.md },
  rule: { flex: 1, height: 1, backgroundColor: colors.border },
  error: {
    padding: space.md,
    borderRadius: radius.sm,
    backgroundColor: colors.denyDim,
  },
  notice: {
    padding: space.md,
    borderRadius: radius.sm,
    borderWidth: stroke.hair,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
});
