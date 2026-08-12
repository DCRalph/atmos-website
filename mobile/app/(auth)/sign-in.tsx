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
import { colors, radius, space } from "@/lib/theme";
import { Body, Button, Caption, Eyebrow, Title } from "@/components/ui";

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

        <Button variant="outline" onPress={google} disabled={pending}>
          Continue with Google
        </Button>

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
  divider: { flexDirection: "row", alignItems: "center", gap: space.md },
  rule: { flex: 1, height: 1, backgroundColor: colors.border },
  error: {
    padding: space.md,
    borderRadius: radius.sm,
    backgroundColor: colors.denyDim,
  },
});
