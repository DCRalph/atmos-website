import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import * as SplashScreen from "expo-splash-screen";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { colors } from "@/lib/theme";

/**
 * Must match `imageWidth` on the `expo-splash-screen` plugin in `app.config.ts`,
 * so the overlay's wordmark sits exactly where the native splash drew it and the
 * hand-off is invisible.
 */
const SPLASH_IMAGE_WIDTH = 300;

// Called at module scope, as the docs insist: from inside a component it can
// land after the native splash has already gone.
void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ fade: false, duration: 0 });

/**
 * Takes over from the native splash with an identical frame, then opens into
 * the app: the wordmark draws back a touch, flies at the viewer and dissolves,
 * while the app underneath settles from slightly zoomed in.
 *
 * Wraps the whole navigator so the app's own settle can be driven from here.
 */
export function LaunchReveal({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const [done, setDone] = useState(false);
  const [started, setStarted] = useState(false);
  const logoScale = useSharedValue(1);
  const logoOpacity = useSharedValue(1);
  const veil = useSharedValue(1);
  const appScale = useSharedValue(reduceMotion ? 1 : 1.08);

  const start = () => setStarted(true);

  // A stuck native splash is a dead app, so never wait on the image forever.
  useEffect(() => {
    const fallback = setTimeout(start, 1500);
    return () => clearTimeout(fallback);
  }, []);

  useEffect(() => {
    if (!started) return;
    void SplashScreen.hideAsync();

    const finish = (finished?: boolean) => {
      "worklet";
      if (finished) scheduleOnRN(setDone, true);
    };

    if (reduceMotion) {
      veil.value = withTiming(0, { duration: 250 }, finish);
      return;
    }

    const out = Easing.bezier(0.7, 0, 0.84, 0);
    logoScale.value = withSequence(
      withTiming(0.92, { duration: 220, easing: Easing.out(Easing.quad) }),
      withTiming(9, { duration: 520, easing: out }),
    );
    logoOpacity.value = withDelay(
      400,
      withTiming(0, { duration: 340, easing: Easing.in(Easing.quad) }),
    );
    veil.value = withDelay(
      460,
      withTiming(0, { duration: 320, easing: Easing.out(Easing.quad) }, finish),
    );
    appScale.value = withDelay(
      460,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }),
    );
  }, [started, reduceMotion, logoScale, logoOpacity, veil, appScale]);

  const appStyle = useAnimatedStyle(() => ({
    transform: [{ scale: appScale.value }],
  }));
  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.value }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.root, appStyle]}>{children}</Animated.View>
      {done ? null : (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Animated.View style={[styles.veil, veilStyle]} />
          <View style={styles.center}>
            <Animated.View style={logoStyle}>
              <Image
                source={require("../../assets/splash-icon.png")}
                style={styles.logo}
                contentFit="contain"
                onDisplay={start}
              />
            </Animated.View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  veil: { ...StyleSheet.absoluteFill, backgroundColor: colors.bg },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { width: SPLASH_IMAGE_WIDTH, height: SPLASH_IMAGE_WIDTH },
});
