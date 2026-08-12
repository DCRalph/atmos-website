import { Stack } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import { StripeTerminalProvider } from "@stripe/stripe-terminal-react-native";

import { api } from "@/lib/api";
import { colors } from "@/lib/theme";

/**
 * Door mode.
 *
 * The screen is kept awake for the whole session — a scanner that sleeps
 * between arrivals is one somebody has to wake with wet hands while a queue
 * builds. That is one of the things the web door simply cannot do.
 *
 * The Terminal provider wraps the whole stack rather than just the sell screen
 * so the reader stays connected between sales; reconnecting per transaction
 * adds seconds to every tap.
 */
export default function DoorLayout() {
  useKeepAwake();

  const connectionToken = api.terminal.connectionToken.useMutation();

  return (
    <StripeTerminalProvider
      logLevel="error"
      tokenProvider={async () => {
        // Minted server-side against the secret key, which is what stops a
        // decompiled app acting as a reader on this account.
        const { secret } = await connectionToken.mutateAsync();
        return secret;
      }}
    >
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
    </StripeTerminalProvider>
  );
}
