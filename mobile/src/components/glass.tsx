import type { ReactNode } from "react";
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from "expo-glass-effect";

/**
 * Whether this phone draws real Liquid Glass (iOS 26+). Read once: it can't
 * change while the app runs.
 */
const LIQUID_GLASS =
  Platform.OS === "ios" &&
  isLiquidGlassAvailable() &&
  isGlassEffectAPIAvailable();

/**
 * Glass, the site's `glass` / `glass-dark`. On iOS 26 this is the system's
 * Liquid Glass; everywhere else a dark blur with the site's hairline edge and
 * top highlight. Like on the site, it belongs over imagery or scrolling
 * content, never as decoration on flat black.
 *
 * `dark` is the denser tint for text-heavy panels, `interactive` lets Liquid
 * Glass respond to touch on things you press.
 */
export function Glass({
  children,
  style,
  dark,
  interactive,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  dark?: boolean;
  interactive?: boolean;
}) {
  if (LIQUID_GLASS) {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme="dark"
        tintColor={dark ? "rgba(0,0,0,0.45)" : undefined}
        isInteractive={interactive}
        style={[{ overflow: "hidden" }, style]}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <View style={[styles.fallback, style]}>
      <BlurView
        tint="dark"
        intensity={dark ? 70 : 50}
        style={[StyleSheet.absoluteFill, dark && styles.dark]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
  },
  dark: { backgroundColor: "rgba(8,8,8,0.45)" },
});
