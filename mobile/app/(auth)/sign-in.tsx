import { useState } from "react";
import { useRouter } from "expo-router";
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

import { signIn, signUp } from "@/lib/auth";
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
      router.back();
    } catch {
      setError("Couldn't reach Atmos. Check your connection and try again.");
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
      router.back();
    } catch {
      setError("Couldn't finish signing in with Google.");
    } finally {
      setPending(false);
    }
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
          keyboardType="email-address"
          textContentType="emailAddress"
        />

        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
        />

        {error ? (
          <View style={styles.error}>
            <Caption style={{ color: colors.deny }}>{error}</Caption>
          </View>
        ) : null}

        <Button onPress={submit} loading={pending}>
          {mode === "sign-in" ? "Sign in" : "Create account"}
        </Button>

        <Pressable
          onPress={() => {
            setMode(mode === "sign-in" ? "sign-up" : "sign-in");
            setError(null);
          }}
          hitSlop={8}
        >
          <Caption style={{ textAlign: "center" }}>
            {mode === "sign-in"
              ? "No account? Create one"
              : "Already have an account? Sign in"}
          </Caption>
        </Pressable>

        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Body soft style={{ textAlign: "center" }}>
            Not now
          </Body>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
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
  divider: { flexDirection: "row", alignItems: "center", gap: space.md },
  rule: { flex: 1, height: 1, backgroundColor: colors.border },
  error: {
    padding: space.md,
    borderRadius: radius.sm,
    backgroundColor: colors.denyDim,
  },
});
