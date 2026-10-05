import { DarkTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { Providers } from "@/components/providers";
import { colors } from "@/lib/theme";

/**
 * React Navigation's own colours, set to ours.
 *
 * Its default theme is light, and a native stack paints its container in the
 * theme's background. iOS shows that container at the rounded corners of a
 * screen being swiped back, which was a flash of near-white on a black app.
 */
const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.border,
  },
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <Providers>
          <ThemeProvider value={navigationTheme}>
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
                options={{
                  presentation: "modal",
                  animation: "slide_from_bottom",
                }}
              />
              <Stack.Screen
                name="(checkout)"
                options={{
                  presentation: "modal",
                  animation: "slide_from_bottom",
                }}
              />
              {/* Full screen, outside the tabs: at a door you want the whole
                display and no way to fat-finger into the gig list. */}
              <Stack.Screen name="(door)" options={{ animation: "fade" }} />
            </Stack>
          </ThemeProvider>
        </Providers>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
