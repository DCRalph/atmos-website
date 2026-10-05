import { Image } from "expo-image";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { colors, radius, type } from "@/lib/theme";

/** Every poster on the site is one box so cards line up in a grid. */
export const POSTER_RATIO = 4 / 5;

/**
 * Gig poster, hard-edged: imagery never takes a radius. A TBA gig shows its
 * poster blurred behind "TBA"; no poster at all is a quiet wordmark block.
 * The caller sets the size.
 */
export function Poster({
  uri,
  tba,
  style,
  tbaSize = 14,
}: {
  uri: string | null | undefined;
  tba?: boolean;
  style?: StyleProp<ViewStyle>;
  tbaSize?: number;
}) {
  return (
    <View style={[styles.poster, style]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          blurRadius={tba ? 24 : 0}
          transition={180}
        />
      ) : (
        <View style={styles.fallback}>
          <Image
            source={require("../../assets/atmos-wordmark.png")}
            style={styles.fallbackMark}
            contentFit="contain"
          />
        </View>
      )}
      {tba ? (
        <View style={[StyleSheet.absoluteFill, styles.tba]}>
          <Text style={[styles.tbaLabel, { fontSize: tbaSize }]}>TBA</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * The site's month tab: accent month over the year, or a dashed "TBA" tab
 * when there's no date.
 */
export function MonthBadge({ month, year }: { month?: string; year?: string }) {
  if (!month) {
    return (
      <View style={[styles.badge, styles.badgeTba]}>
        <Text style={[styles.badgeLabel, { color: colors.textSoft }]}>TBA</Text>
      </View>
    );
  }
  return (
    <View style={styles.badge}>
      <Text style={[styles.badgeLabel, styles.badgeMonth]}>{month}</Text>
      <Text style={[styles.badgeLabel, styles.badgeYear]}>{year}</Text>
    </View>
  );
}

/**
 * Black fade over imagery, the site's `scrim-bottom`: solid at the bottom,
 * clear by three quarters of the way up, so type can sit on a poster.
 */
export function Scrim({ from = 0.25 }: { from?: number }) {
  return (
    <Svg
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      preserveAspectRatio="none"
    >
      <Defs>
        <LinearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
          <Stop offset={String(from)} stopColor="#000" stopOpacity="0" />
          <Stop offset="0.65" stopColor="#000" stopOpacity="0.7" />
          <Stop offset="1" stopColor="#000" stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#scrim)" />
    </Svg>
  );
}

/**
 * The poster blown up and blurred out behind a whole screen, the ticket
 * pages' backdrop. Static on purpose: nothing moves behind a QR code.
 */
export function Ambient({
  uri,
  dim = 0.55,
}: {
  uri: string | null | undefined;
  dim?: number;
}) {
  if (!uri) return null;
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}
    >
      <Image
        source={{ uri }}
        style={[StyleSheet.absoluteFill, { transform: [{ scale: 1.3 }] }]}
        contentFit="cover"
        blurRadius={60}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: `rgba(0,0,0,${dim})` },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  poster: { overflow: "hidden", backgroundColor: "rgba(255,255,255,0.05)" },
  fallback: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  fallbackMark: { width: "70%", aspectRatio: 5001 / 1120, opacity: 0.25 },
  tba: {
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  tbaLabel: { ...type.display, color: colors.text },
  badge: { width: 56, borderRadius: radius.sm, overflow: "hidden" },
  badgeTba: {
    height: 52,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderHard,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeLabel: { ...type.label, fontSize: 10, textAlign: "center" },
  badgeMonth: {
    backgroundColor: colors.accent,
    color: colors.accentInk,
    paddingVertical: 6,
  },
  badgeYear: {
    backgroundColor: "rgba(255,255,255,0.10)",
    color: "rgba(255,255,255,0.8)",
    paddingVertical: 6,
  },
});
