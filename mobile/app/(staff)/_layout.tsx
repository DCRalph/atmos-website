import { Stack } from "expo-router";

import { BiometricGate } from "@/lib/biometrics";
import { StaffGate } from "@/components/staff-gate";
import { colors } from "@/lib/theme";

/**
 * Screens for everybody working the night, not just the people running it.
 *
 * Its own group rather than a corner of `(admin)`, because `role="staff"` is a
 * wider door than that section wants: a scanner rostered on tonight belongs
 * here and has no business in event takings. The server draws the same line
 * again per gig, so this only decides what is worth rendering.
 *
 * The biometric lock is repeated here for the reason `(door)` and `(admin)`
 * repeat it: a notification tap is a deep link, and a deep link has to land on
 * the same challenge as the way in through More.
 */
export default function StaffLayout() {
  return (
    <StaffGate role="staff">
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
