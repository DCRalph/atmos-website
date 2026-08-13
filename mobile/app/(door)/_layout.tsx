import { Stack } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";

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
 */
export default function DoorLayout() {
  useKeepAwake();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
