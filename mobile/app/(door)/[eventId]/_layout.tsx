import { useState } from "react";
import { Stack, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/lib/api";
import { colors } from "@/lib/theme";
import {
  DoorHeader,
  DoorHeaderSpaceProvider,
  doorHeaderSpace,
} from "@/components/door/door-header";

/**
 * One event's door: Scan, Manual, List and the rest.
 *
 * They are tabs, not pages. The header floats over all of them and stays put;
 * its tabs switch with `router.replace`, so this stack only ever holds the one
 * tab on screen, and the new one cross-fades in under the header rather than
 * sliding in like a push. Close leaves the whole stack, which is the event,
 * and that still animates as a back in the door stack outside.
 *
 * Every door result and sheet is a `Modal`, so it covers the header too.
 */
export default function DoorEventLayout() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const insets = useSafeAreaInsets();
  const [space, setSpace] = useState(() => doorHeaderSpace(insets.top));

  // Polled, like the web scanner: on a second door the headcount moves without
  // anything happening on this phone, and a stale number is one staff act on.
  // The tabs read the same query, so a scan's refetch reaches this too.
  const summary = api.door.summary.useQuery(
    { eventId },
    { enabled: !!eventId, refetchInterval: 15_000 },
  );

  return (
    <DoorHeaderSpaceProvider value={space}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "fade",
            animationDuration: 180,
            contentStyle: { backgroundColor: colors.bg },
          }}
        />
        <DoorHeader
          eventId={eventId}
          summary={summary.data}
          onSpace={setSpace}
        />
      </View>
    </DoorHeaderSpaceProvider>
  );
}
