import { Stack } from "expo-router";

import { colors } from "@/lib/theme";

/**
 * Organiser mode.
 *
 * Read-only by design. Everything that changes an event — pricing, tiers,
 * refunds, comps — stays on the web admin, where there is room to see what you
 * are about to do. What a phone is genuinely better at is being carried: this
 * is the dashboard you check on the way to the venue and hold in your hand
 * while the room fills, so it answers questions and edits nothing.
 *
 * Access is enforced server-side on every call by `eventOrganiserProcedure`.
 * Hiding the entry point in More is tidiness, not the boundary.
 */
export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
