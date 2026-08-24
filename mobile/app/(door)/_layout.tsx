import { Stack } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";

import { BiometricGate } from "@/lib/biometrics";
import { StaffGate } from "@/components/staff-gate";
import { colors } from "@/lib/theme";

/**
 * Door mode.
 *
 * The screen is kept awake for the whole session — a scanner that sleeps
 * between arrivals is one somebody has to wake with wet hands while a queue
 * builds. That is one of the things the web door simply cannot do.
 *
 * The Stripe Terminal provider used to live here. It now sits at the app root
 * (`src/components/providers.tsx`), because Apple's checklist 1.5 asks for the
 * reader to be warmed up at launch rather than when somebody walks into door
 * mode — by then the queue has already formed.
 *
 * The two gates do live here. `StaffGate` keeps the whole area, Tap to Pay
 * screens included, off a punter's phone however they arrived — the server
 * refuses the calls regardless, but a customer should not be able to find out
 * the internal tooling exists. `BiometricGate` is the reason biometrics were
 * added at all: a handset put down on a bar is one tap from the guest list and
 * the card reader.
 */
export default function DoorLayout() {
  useKeepAwake();

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
