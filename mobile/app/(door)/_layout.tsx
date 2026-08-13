import { Stack } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";

import { DoorTerminalProvider } from "@/components/door/terminal";
import { colors } from "@/lib/theme";

/**
 * Door mode.
 *
 * The screen is kept awake for the whole session — a scanner that sleeps
 * between arrivals is one somebody has to wake with wet hands while a queue
 * builds. That is one of the things the web door simply cannot do.
 */
export default function DoorLayout() {
  useKeepAwake();

  return (
    <DoorTerminalProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
    </DoorTerminalProvider>
  );
}
