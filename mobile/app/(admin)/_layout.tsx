import { Stack } from "expo-router";

import { BiometricGate } from "@/lib/biometrics";
import { StaffGate } from "@/components/staff-gate";
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
 * Access is enforced server-side on every call. The analytics screens answer
 * organisers and anyone granted one event's sales (`eventViewProcedure`, which
 * also scopes the event list); gig rooms and Notify team are organiser only and
 * gate themselves again. `StaffGate` makes sure nobody else sees the screens,
 * however they got here. The biometric lock is the third layer: takings and a guest
 * list should not be readable off a handset somebody picked up, even by
 * somebody the server would happily answer.
 */
export default function AdminLayout() {
  return (
    <StaffGate role="sales">
      <BiometricGate>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        />
      </BiometricGate>
    </StaffGate>
  );
}
