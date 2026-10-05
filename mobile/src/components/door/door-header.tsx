import { createContext, useContext, useEffect, useRef } from "react";
import * as Haptics from "expo-haptics";
import { useRouter, useSegments } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutRectangle,
} from "react-native";
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";

import type { RouterOutputs } from "@/lib/api";
import { useDeviceLabel } from "@/lib/device-label";
import { colors, radius, space, type } from "@/lib/theme";
import { Caption, IconButton } from "@/components/ui";
import { Glass } from "@/components/glass";
import { SPRING, shareOf } from "@/components/tab-bar";
import { OfflineBanner } from "@/components/door/offline-banner";

type Summary = RouterOutputs["door"]["summary"];

/** The door's tabs, by route name under `app/(door)/[eventId]/`. */
const MODES = [
  { path: "scan", label: "Scan" },
  { path: "manual", label: "Manual" },
  { path: "list", label: "List" },
  { path: "sell", label: "Sell" },
  // The one tab that decides nothing: looks a ticket up and records no scan.
  { path: "check", label: "Check" },
  // The other half of the door: everything else here decides about a ticket,
  // this one decides about the person holding it.
  { path: "id", label: "ID" },
  // A door with no log is a door that cannot answer "what happened ten
  // minutes ago", hence the short label rather than dropping it.
  { path: "activity", label: "Log" },
] as const;

/** The card's distance from the status bar, and its inner padding. */
const CARD_TOP = space.xs;
const PAD = space.md;
const CLOSE = 40;
const TAB_HEIGHT = 32;

/**
 * How far a door screen's content starts from the top of the screen, so it
 * begins under the floating header rather than behind it. Provided by
 * `[eventId]/_layout.tsx`, which measures the header.
 */
const HeaderSpace = createContext(0);
export const DoorHeaderSpaceProvider = HeaderSpace.Provider;

/**
 * The space a door screen leaves above its content. Before the header has
 * been measured this is the height it is drawn at without the offline banner,
 * so the first frame does not jump.
 */
export function useDoorHeaderSpace() {
  return useContext(HeaderSpace);
}

/** Where content starts when the header has no banner: the initial space. */
export function doorHeaderSpace(topInset: number) {
  return (
    topInset + CARD_TOP + PAD * 2 + CLOSE + space.md + TAB_HEIGHT + space.md
  );
}

/** A spacer the height of `useDoorHeaderSpace`, for the top of a column. */
export function DoorHeaderSpace() {
  return <View style={{ height: useDoorHeaderSpace() }} />;
}

/**
 * The card floating over every door screen: who is in, out of how many, and
 * the ways to admit somebody. The headcount is the number staff are asked for
 * all night, so it stays on screen rather than living behind a tab.
 *
 * Rendered once, by `[eventId]/_layout.tsx`, above whichever tab is showing,
 * so it stays put while the screen under it changes. The tabs work like the
 * main tab bar: one white pill slides to the tab you pick, on the same spring,
 * and the row scrolls to keep it in view. Each tab replaces the screen rather
 * than stacking on it, so close leaves the event however many were visited.
 *
 * Glass, because on the scanner it floats over the camera.
 */
export function DoorHeader({
  eventId,
  summary,
  onSpace,
}: {
  eventId: string;
  summary: Summary | undefined;
  /** Reports where content should start: the card's bottom edge plus a gap. */
  onSpace: (space: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments();
  const { deviceLabel } = useDeviceLabel();

  const active = Math.max(
    0,
    MODES.findIndex((mode) => mode.path === segments.at(-1)),
  );

  const admitted = summary?.admitted ?? 0;
  const sold = summary?.sold ?? 0;

  // Where each tab sits in the row, measured. Kept off the UI thread: the
  // pill reads only the two numbers it springs between.
  const tabs = useRef<{ x: number; width: number }[]>([]);
  const pillX = useSharedValue(0);
  const pillWidth = useSharedValue(0);
  // The active index as a spring too, so labels turn black as the pill
  // arrives rather than the moment the tab is pressed.
  const position = useSharedValue(active);

  const indicator = useAnimatedStyle(() => ({
    width: pillWidth.value,
    transform: [{ translateX: pillX.value }],
  }));

  // Keeps the active tab centred in the row where the row can scroll that far.
  const row = useRef<ScrollView>(null);
  const rowWidth = useRef(0);
  const contentWidth = useRef(0);

  /** Puts the pill on the active tab and scrolls it into view. */
  const settle = (animated: boolean) => {
    const tab = tabs.current[active];
    if (!tab) return;
    pillX.value = animated ? withSpring(tab.x, SPRING) : tab.x;
    pillWidth.value = animated ? withSpring(tab.width, SPRING) : tab.width;
    if (!rowWidth.current) return;
    const max = Math.max(0, contentWidth.current - rowWidth.current);
    const x = tab.x + tab.width / 2 - rowWidth.current / 2;
    row.current?.scrollTo({ x: Math.min(max, Math.max(0, x)), animated });
  };

  useEffect(() => {
    position.value = withSpring(active, SPRING);
    settle(true);
    // `settle` reads refs; the tab changing is the only reason to re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <View
      pointerEvents="box-none"
      onLayout={({ nativeEvent }) =>
        onSpace(nativeEvent.layout.y + nativeEvent.layout.height + space.md)
      }
      style={[styles.wrap, { top: insets.top + CARD_TOP }]}
    >
      <Glass dark style={styles.card}>
        {/* Above everything: losing signal changes what the door can do at
            all, so it outranks the headcount for attention. */}
        <View style={styles.banner}>
          <OfflineBanner />
        </View>

        <View style={styles.top}>
          <IconButton
            label="Close"
            icon={X}
            size={CLOSE}
            onPress={() => router.back()}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={styles.event}>
              {summary?.event.name ?? "Door"}
            </Text>
            <Caption numberOfLines={1} style={{ marginTop: 3 }}>
              {[
                // Which door this handset is, as every scan from it is tagged.
                deviceLabel.trim() || null,
                summary?.event.venueName,
                summary?.event.isR18 ? "R18" : null,
                summary?.event.reentryAllowed ? "re-entry ok" : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Caption>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.count}>
              {admitted}
              <Text style={styles.countTotal}>/{sold}</Text>
            </Text>
            <Text style={styles.countLabel}>
              {summary?.notArrived ?? 0} to come
            </Text>
          </View>
        </View>

        <ScrollView
          ref={row}
          horizontal
          showsHorizontalScrollIndicator={false}
          onLayout={({ nativeEvent }) => {
            rowWidth.current = nativeEvent.layout.width;
          }}
          onContentSizeChange={(width) => {
            contentWidth.current = width;
            settle(false);
          }}
          style={styles.modes}
          contentContainerStyle={styles.modesRow}
        >
          <Animated.View
            pointerEvents="none"
            style={[styles.indicator, indicator]}
          />
          {MODES.map((mode, index) => (
            <ModeTab
              key={mode.path}
              index={index}
              position={position}
              label={mode.label}
              selected={index === active}
              onLayout={({ x, width }) => {
                tabs.current[index] = { x, width };
                if (index === active) settle(false);
              }}
              onPress={() => {
                if (index === active) return;
                void Haptics.selectionAsync();
                router.replace({
                  pathname: `/(door)/[eventId]/${mode.path}`,
                  params: { eventId },
                });
              }}
            />
          ))}
        </ScrollView>
      </Glass>
    </View>
  );
}

/**
 * One tab in the row. Its label turns black as the pill arrives over it, and
 * it gives under the finger like the main tab bar's.
 */
function ModeTab({
  index,
  position,
  label,
  selected,
  onLayout,
  onPress,
}: {
  index: number;
  position: SharedValue<number>;
  label: string;
  selected: boolean;
  onLayout: (layout: LayoutRectangle) => void;
  onPress: () => void;
}) {
  const pressed = useSharedValue(0);

  const tab = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.92]) }],
  }));
  const text = useAnimatedStyle(() => ({
    color: interpolateColor(
      shareOf(position.value, index),
      [0, 1],
      [colors.textSoft, colors.accentInk],
    ),
  }));

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onLayout={({ nativeEvent }) => onLayout(nativeEvent.layout)}
      onPress={onPress}
      onPressIn={() => {
        pressed.value = withSpring(1, SPRING);
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, SPRING);
      }}
      hitSlop={{ top: 6, bottom: 6 }}
    >
      <Animated.View style={[styles.mode, tab]}>
        <Animated.Text style={[styles.modeLabel, text]}>{label}</Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: space.md,
    right: space.md,
    zIndex: 2,
  },
  // Concentric with the close button: its radius plus the padding around it.
  card: {
    padding: PAD,
    gap: space.md,
    borderRadius: CLOSE / 2 + PAD,
  },
  banner: { marginHorizontal: -PAD, marginTop: -PAD },
  top: { flexDirection: "row", alignItems: "center", gap: space.md },
  event: { ...type.display, fontSize: 15, lineHeight: 18, color: colors.text, textTransform: "none" },
  count: {
    ...type.display,
    fontSize: 22,
    lineHeight: 24,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  countTotal: { color: colors.textFaint },
  countLabel: { ...type.label, fontSize: 9, color: colors.textFaint, marginTop: 3 },
  modes: { marginHorizontal: -PAD },
  modesRow: { paddingHorizontal: PAD, gap: 6 },
  indicator: {
    position: "absolute",
    top: 0,
    left: 0,
    height: TAB_HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
  },
  mode: {
    height: TAB_HEIGHT,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  modeLabel: { ...type.label, fontSize: 10 },
});
