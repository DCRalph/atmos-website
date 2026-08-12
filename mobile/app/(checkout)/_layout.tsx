import { StripeProvider } from "@stripe/stripe-react-native";
import { Stack } from "expo-router";

import { api } from "@/lib/api";
import { colors } from "@/lib/theme";

/**
 * Checkout, as a modal stack.
 *
 * It holds real stock on a timer, so it deliberately sits outside the tabs —
 * there is no tab bar to wander off into halfway through a reservation.
 *
 * The publishable key is fetched rather than baked in so the app follows
 * whatever the server is configured with; test and live keys never have to be
 * kept in step by hand across two codebases.
 */
export default function CheckoutLayout() {
  const config = api.ticketCheckout.config.useQuery();

  return (
    <StripeProvider
      publishableKey={config.data?.publishableKey ?? ""}
      merchantIdentifier="merchant.nz.co.atmos.app"
    >
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
    </StripeProvider>
  );
}
