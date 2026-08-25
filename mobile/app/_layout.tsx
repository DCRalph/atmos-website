import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { Providers } from "@/components/providers";
import { colors } from "@/lib/theme";

export default function RootLayout() {
  const __shotRouter = useRouter();
  useEffect(() => {
    const t = setTimeout(() => __shotRouter.replace("/"), 600);
    return () => clearTimeout(t);
  }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <Providers>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="(auth)"
              options={{ presentation: "modal", animation: "slide_from_bottom" }}
            />
            <Stack.Screen
              name="(checkout)"
              options={{ presentation: "modal", animation: "slide_from_bottom" }}
            />
            {/* Full screen, outside the tabs: at a door you want the whole
                display and no way to fat-finger into the gig list. */}
            <Stack.Screen name="(door)" options={{ animation: "fade" }} />
          </Stack>
        </Providers>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
