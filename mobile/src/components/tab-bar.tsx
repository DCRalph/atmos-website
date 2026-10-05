import { useEffect } from "react";
import * as Haptics from "expo-haptics";
import type { BottomTabBarProps } from "expo-router/tabs";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarDays, House, Menu, Ticket } from "lucide-react-native";

import { colors, space, type } from "@/lib/theme";
import { Glass } from "@/components/glass";
import { BottomFade } from "@/components/screen-header";

/** Bar height, and the inner padding around the tabs. */
const HEIGHT = 58;
const PAD = 6;
/** A tab's width as an icon, and as the white pill that names itself. */
const ICON_WIDTH = 46;
const PILL_WIDTH = 124;
const GAP = 2;
const ICON = 20;

/**
 * One spring for every part of a tab change, so the pill, the icons and the
 * label all land together. Just under critical damping: it settles with the
 * faint give of the system's own glass controls, never a wobble, and never
 * overshoots far enough to poke the pill past the capsule's ends.
 * Reanimated drops it to an instant change under Reduce Motion. The door's
 * tabs (`DoorHeader`) use it too, so every tab change in the app feels alike.
 */
export const SPRING = { damping: 26, stiffness: 260, mass: 0.9 } as const;
/** How much wider the pill gets halfway between two tabs. */
const STRETCH = 16;

/** Lucide, the same set the website draws its icons from. */
const icons: Record<string, typeof House> = {
  index: House,
  gigs: CalendarDays,
  tickets: Ticket,
  more: Menu,
};

/** Where the bar's bottom edge sits: just inside the home indicator. */
const offset = (bottomInset: number) => Math.max(bottomInset - 6, space.md);

/**
 * Room a tab screen leaves under its content so the last row can scroll
 * clear of the floating bar.
 */
export function useTabBarSpace() {
  const insets = useSafeAreaInsets();
  return offset(insets.bottom) + HEIGHT + space.xl;
}

/**
 * The tab bar: a small floating glass capsule, centred. Inactive tabs are
 * icons only; the active one sits in a white pill that names it. A tab change
 * slides the one pill across, stretching a little in flight, while the tabs
 * it leaves and reaches trade width under it. Content dissolves into black
 * before it reaches the bar, so nothing ever reads through the glass behind
 * the icons.
 *
 * Everything is driven by `position`, the active index as a spring. At rest
 * it's a whole number; between two tabs its fraction says how far across the
 * pill is. Exactly one tab's worth of width is ever "pill", so the capsule
 * itself never changes size.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottom = offset(insets.bottom);
  const count = state.routes.length;

  const position = useSharedValue(state.index);
  useEffect(() => {
    position.value = withSpring(state.index, SPRING);
  }, [position, state.index]);

  const indicator = useAnimatedStyle(() => {
    // 0 at either tab, 1 halfway: the pill stretches as it travels.
    const travel = Math.sin(
      Math.PI * (position.value - Math.floor(position.value)),
    );
    return {
      width: PILL_WIDTH + STRETCH * travel,
      transform: [
        {
          translateX:
            PAD + position.value * (ICON_WIDTH + GAP) - (STRETCH / 2) * travel,
        },
      ],
    };
  });

  return (
    <>
      <BottomFade height={bottom + HEIGHT + space.xxl} />
      <View pointerEvents="box-none" style={[styles.wrap, { bottom }]}>
        <Glass
          interactive
          style={[
            styles.bar,
            {
              width:
                PILL_WIDTH +
                ICON_WIDTH * (count - 1) +
                GAP * (count - 1) +
                PAD * 2,
            },
          ]}
        >
          <Animated.View
            pointerEvents="none"
            style={[styles.pill, indicator]}
          />
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const { options } = descriptors[route.key]!;
            return (
              <Tab
                key={route.key}
                index={index}
                position={position}
                label={options.title ?? route.name}
                Icon={icons[route.name] ?? House}
                focused={focused}
                onPress={() => {
                  const event = navigation.emit({
                    type: "tabPress",
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!focused && !event.defaultPrevented) {
                    void Haptics.selectionAsync();
                    navigation.navigate(route.name, route.params);
                  }
                }}
                onLongPress={() =>
                  navigation.emit({ type: "tabLongPress", target: route.key })
                }
              />
            );
          })}
        </Glass>
      </View>
    </>
  );
}

/**
 * How much of the pill is over tab `index` when it's at `position`: 1 when
 * it's home, 0 once it's a whole tab away. Takes the number rather than the
 * shared value: Reanimated only re-runs an animated style for shared values
 * it reads directly.
 */
export function shareOf(position: number, index: number) {
  "worklet";
  return Math.max(0, 1 - Math.abs(position - index));
}

function Tab({
  index,
  position,
  label,
  Icon,
  focused,
  onPress,
  onLongPress,
}: {
  index: number;
  position: SharedValue<number>;
  label: string;
  Icon: typeof House;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const pressed = useSharedValue(0);
  // Only the destination names itself: on a jump across several tabs the
  // ones the pill passes over stay icons, rather than flashing their labels.
  const named = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    named.value = withTiming(focused ? 1 : 0, {
      duration: focused ? 220 : 90,
    });
  }, [named, focused]);

  const tab = useAnimatedStyle(() => ({
    width:
      ICON_WIDTH + (PILL_WIDTH - ICON_WIDTH) * shareOf(position.value, index),
    // Centres the icon in the round tab, and gives the pill its inset.
    paddingLeft: interpolate(
      shareOf(position.value, index),
      [0, 1],
      [(ICON_WIDTH - ICON) / 2, 18],
    ),
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.9]) }],
  }));

  // The icon is drawn twice, white and black, and cross-faded as the pill
  // passes: Lucide's colour is a prop, not something a native animation can
  // reach.
  const light = useAnimatedStyle(() => ({
    opacity: 1 - shareOf(position.value, index),
  }));
  const dark = useAnimatedStyle(() => ({
    opacity: shareOf(position.value, index),
  }));
  // Arrives late and leaves early, so it's never squeezed by a narrow tab.
  const name = useAnimatedStyle(() => ({
    opacity:
      named.value *
      interpolate(
        shareOf(position.value, index),
        [0.6, 1],
        [0, 1],
        Extrapolation.CLAMP,
      ),
    transform: [
      {
        translateX: interpolate(
          shareOf(position.value, index),
          [0, 1],
          [-6, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => {
        pressed.value = withSpring(1, SPRING);
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, SPRING);
      }}
    >
      <Animated.View style={[styles.tab, tab]}>
        <View style={styles.icon}>
          <Animated.View style={[StyleSheet.absoluteFill, light]}>
            <Icon color={colors.textSoft} size={ICON} strokeWidth={1.75} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, dark]}>
            <Icon color={colors.accentInk} size={ICON} strokeWidth={2.25} />
          </Animated.View>
        </View>
        <Animated.Text numberOfLines={1} style={[styles.label, name]}>
          {label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  bar: {
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    flexDirection: "row",
    alignItems: "center",
    gap: GAP,
    padding: PAD,
  },
  pill: {
    position: "absolute",
    top: PAD,
    left: 0,
    height: HEIGHT - PAD * 2,
    borderRadius: (HEIGHT - PAD * 2) / 2,
    backgroundColor: colors.text,
  },
  tab: {
    height: HEIGHT - PAD * 2,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    overflow: "hidden",
  },
  icon: { width: ICON, height: ICON },
  label: { ...type.label, fontSize: 10, color: colors.accentInk },
});
