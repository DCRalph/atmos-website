import { useRef, type ReactNode } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { colors, space, type } from "@/lib/theme";

/** Height of the pinned bar below the status bar. */
export const HEADER_HEIGHT = 52;

/** How far a `LargeTitle` scrolls before the bar takes over its name. */
export const LARGE_TITLE_REVEAL = 56;

/** The soft edge under the solid bar, so content fades out rather than cuts. */
export const HEADER_TAIL = 20;

/**
 * Scroll position for a screen with a pinned header. Spread `scrollProps` on
 * an `Animated.ScrollView`; the offset runs on the native driver, so the
 * header never waits on JS.
 */
export function useScrollHeader() {
  const scrollY = useRef(new Animated.Value(0)).current;
  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true },
  );
  return { scrollY, scrollProps: { onScroll, scrollEventThrottle: 16 } };
}

/**
 * 0 at rest, 1 once `scrollY` reaches `at`, over the last `over` points.
 * `at` of 0 or less means always shown.
 */
const reveal = (scrollY: Animated.Value, at: number, over = 16) =>
  at <= 0
    ? 1
    : scrollY.interpolate({
        inputRange: [Math.max(0, at - over), at],
        outputRange: [0, 1],
        extrapolate: "clamp",
      });

/**
 * The bar pinned over the top of a scrolling screen, iOS large-title style.
 *
 * The one rule: text never scrolls under the bar while it's see-through.
 * `solidAt` is the scroll offset at which the screen's first text reaches
 * the bar; the bar is solid black by then, with a short fade below it so
 * content dissolves into it. Before that only imagery (a hero poster) passes
 * under, and `shade` keeps the clock and the bar's own buttons legible over
 * it. The small `title` arrives at `titleAt`, once the screen's own large
 * title has gone.
 *
 * `left` and `right` are always on screen (a wordmark, a back button).
 */
export function PinnedHeader({
  scrollY,
  solidAt = 10,
  titleAt = LARGE_TITLE_REVEAL,
  shade,
  title,
  left,
  right,
}: {
  scrollY: Animated.Value;
  solidAt?: number;
  titleAt?: number;
  shade?: boolean;
  title?: string;
  left?: ReactNode;
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const height = insets.top + HEADER_HEIGHT;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingTop: insets.top, height }]}
    >
      {shade ? (
        <Fade
          from="rgba(0,0,0,0.7)"
          style={{ top: 0, height: height + space.xl }}
        />
      ) : null}

      {/* Solid rather than blurred: a blur under an animated opacity renders
          wrong on iOS, and the site's ground is black anyway. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.backdrop, { height, opacity: reveal(scrollY, solidAt) }]}
      >
        <Fade from="#000" style={{ top: height, height: HEADER_TAIL }} />
      </Animated.View>

      <View pointerEvents="box-none" style={styles.row}>
        <View style={styles.side}>{left}</View>
        {title ? (
          <Animated.Text
            numberOfLines={1}
            style={[styles.title, { opacity: reveal(scrollY, titleAt) }]}
          >
            {title}
          </Animated.Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <View style={[styles.side, { alignItems: "flex-end" }]}>{right}</View>
      </View>
    </View>
  );
}

/**
 * The large title a tab opens on, just under the pinned bar. Pair it with a
 * `PinnedHeader` on its defaults so the name hands over as it scrolls away.
 */
export function LargeTitle({
  children,
  right,
}: {
  children: string;
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.largeRow, { paddingTop: insets.top + HEADER_HEIGHT }]}>
      <Text style={styles.large}>{children}</Text>
      {right}
    </View>
  );
}

/**
 * Content dissolving into black at the bottom edge, under a floating bar or
 * panel, so nothing reads through the glass. Fixed, and ignores touches.
 */
export function BottomFade({ height }: { height: number }) {
  return <Fade from="rgba(0,0,0,0.92)" up style={{ bottom: 0, height }} />;
}

/** A full-width vertical gradient from `from` to clear. */
function Fade({
  from,
  up,
  style,
}: {
  from: string;
  /** Darkest at the bottom instead of the top. */
  up?: boolean;
  style: { top?: number; bottom?: number; height: number };
}) {
  return (
    <Svg
      pointerEvents="none"
      style={[styles.fade, style]}
      preserveAspectRatio="none"
    >
      <Defs>
        <LinearGradient
          id="fade"
          x1="0"
          y1={up ? "1" : "0"}
          x2="0"
          y2={up ? "0" : "1"}
        >
          <Stop offset="0" stopColor={from} stopOpacity="1" />
          <Stop offset="0.55" stopColor={from} stopOpacity="0.7" />
          <Stop offset="1" stopColor={from} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#fade)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bg,
  },
  fade: { position: "absolute", left: 0, right: 0 },
  row: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.lg,
    gap: space.md,
  },
  side: { minWidth: 44, flexShrink: 0 },
  title: {
    ...type.display,
    flex: 1,
    fontSize: 15,
    lineHeight: 18,
    textAlign: "center",
    color: colors.text,
  },
  largeRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: space.md,
    paddingHorizontal: space.lg,
  },
  large: { ...type.heading, fontSize: 44, lineHeight: 46, color: colors.text },
});
