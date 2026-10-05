import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";

import { colors, fonts, radius, space, type } from "@/lib/theme";
import { Glass } from "@/components/glass";

/**
 * Pinned header for pushed screens: safe-area padding, a round back button,
 * the screen's name and a hairline. It sits outside the screen's scroll view,
 * so it stays put however far the content goes.
 */
export function Header({
  title,
  onBack,
  right,
}: {
  title: ReactNode;
  onBack?: () => void;
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.headerBar, { paddingTop: insets.top + space.sm }]}>
      {onBack ? (
        <IconButton label="Back" icon={ArrowLeft} onPress={onBack} />
      ) : null}
      <Text numberOfLines={1} style={styles.headerTitle}>
        {title}
      </Text>
      {right}
    </View>
  );
}

/**
 * Round icon-only control. Glass, since it usually floats over imagery; on
 * plain black it reads as a soft grey disc.
 */
export function IconButton({
  label,
  icon: Icon,
  onPress,
  size = 40,
}: {
  label: string;
  icon: typeof ArrowLeft;
  onPress: () => void;
  size?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
    >
      {({ pressed }) => (
        <Glass
          interactive
          style={[
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              alignItems: "center",
              justifyContent: "center",
            },
            pressed && { opacity: 0.75 },
          ]}
        >
          <Icon color={colors.text} size={size * 0.45} strokeWidth={2.25} />
        </Glass>
      )}
    </Pressable>
  );
}

/** Section marker: the site's small stretched caps, `t-label`. */
export function Eyebrow({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[styles.eyebrow, style]}>{children}</Text>;
}

/** Large heading in Orbitron, the site's `t-heading`. Pass `size` to scale. */
export function Heading({
  children,
  size = type.heading.fontSize,
  style,
}: {
  children: ReactNode;
  size?: number;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      style={[
        styles.heading,
        { fontSize: size, lineHeight: size * 1.02 },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/**
 * Stretched display type for names and numbers, the site's `t-display`.
 * Uppercase unless `keepCase`: people's and gigs' own names keep theirs.
 */
export function Display({
  children,
  size = type.display.fontSize,
  keepCase,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  size?: number;
  keepCase?: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        styles.display,
        { fontSize: size, lineHeight: Math.round(size * 1.08) },
        keepCase && { textTransform: "none" },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** A screen or card title. Display type, as the site sets item names. */
export function Title({
  children,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <Display size={22} numberOfLines={numberOfLines} style={style}>
      {children}
    </Display>
  );
}

export function Body({
  children,
  soft,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  soft?: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[styles.body, soft && { color: colors.textSoft }, style]}
    >
      {children}
    </Text>
  );
}

export function Caption({
  children,
  style,
  numberOfLines,
  onPress,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  /** For an inline link inside a sentence, where a Pressable cannot go. */
  onPress?: () => void;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      onPress={onPress}
      style={[styles.caption, style]}
    >
      {children}
    </Text>
  );
}

/** A panel on black: the site's raised surface, rounded like its glass. */
export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/**
 * Pill button. `primary` (solid white) is the one main action on a screen,
 * `accent` is for buy moments, `outline` and `ghost` are secondary, and
 * `glass` is only for use over imagery.
 */
export function Button({
  children,
  onPress,
  variant = "primary",
  size = "md",
  disabled,
  loading,
  icon: Icon,
  style,
}: {
  children: ReactNode;
  onPress: () => void;
  variant?: "primary" | "accent" | "outline" | "ghost" | "glass";
  /** `sm` is for secondary affordances that should not compete with the
      screen's real action. `lg` is a screen's main call to action. */
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  icon?: typeof ArrowLeft;
  style?: StyleProp<ViewStyle>;
}) {
  const isDisabled = disabled ?? loading;
  const ink =
    variant === "primary" || variant === "accent"
      ? colors.accentInk
      : colors.text;
  const height = { sm: 36, md: 46, lg: 54 }[size];
  const content = loading ? (
    <ActivityIndicator size="small" color={ink} />
  ) : (
    <>
      {Icon ? (
        <Icon color={ink} size={size === "sm" ? 14 : 16} strokeWidth={2.25} />
      ) : null}
      <Text
        style={[
          styles.buttonLabel,
          { color: ink, fontSize: { sm: 10, md: 12, lg: 13 }[size] },
        ]}
      >
        {children}
      </Text>
    </>
  );

  const shape: ViewStyle[] = [
    styles.button,
    { height, paddingHorizontal: size === "sm" ? 16 : 24 },
    size === "sm" && styles.buttonSmall,
  ].filter(Boolean) as ViewStyle[];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        ...(variant === "glass" ? [] : shape),
        variant === "primary" && { backgroundColor: colors.text },
        variant === "accent" && { backgroundColor: colors.accent },
        variant === "outline" && styles.buttonOutline,
        pressed && !isDisabled && { opacity: 0.75 },
        isDisabled && { opacity: 0.4 },
        style,
      ]}
    >
      {variant === "glass" ? (
        <Glass interactive style={shape}>
          {content}
        </Glass>
      ) : (
        content
      )}
    </Pressable>
  );
}

/** Empty state and error state share a shape, so they share a component. */
export function Notice({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.notice}>
      <Display size={17} style={{ textAlign: "center" }}>
        {title}
      </Display>
      {detail ? (
        <Caption
          style={{
            marginTop: space.sm,
            textAlign: "center",
            color: colors.textSoft,
          }}
        >
          {detail}
        </Caption>
      ) : null}
      {action ? <View style={{ marginTop: space.lg }}>{action}</View> : null}
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.textFaint} />
      {label ? (
        <Caption style={{ marginTop: space.sm }}>{label}</Caption>
      ) : null}
    </View>
  );
}

/** Status chip: in / warning / refused, plus a neutral and the accent. */
export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "in" | "warn" | "deny" | "accent";
}) {
  const toneStyle = {
    neutral: { bg: "rgba(255,255,255,0.10)", fg: colors.textSoft },
    in: { bg: colors.inDim, fg: colors.in },
    warn: { bg: colors.warnDim, fg: colors.warn },
    deny: { bg: colors.denyDim, fg: colors.deny },
    accent: { bg: colors.accent, fg: colors.accentInk },
  }[tone];

  return (
    <View style={[styles.pill, { backgroundColor: toneStyle.bg }]}>
      <Text style={[styles.pillLabel, { color: toneStyle.fg }]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    backgroundColor: colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
  },
  headerTitle: {
    ...type.display,
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    lineHeight: 18,
    color: colors.text,
  },
  eyebrow: { ...type.label, fontSize: 10, color: colors.textFaint },
  heading: { ...type.heading, color: colors.text },
  display: { ...type.display, color: colors.text },
  body: { ...type.body, color: colors.text },
  caption: { ...type.caption, color: colors.textFaint },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  button: {
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    overflow: "hidden",
  },
  buttonSmall: { alignSelf: "flex-start" },
  buttonOutline: { borderWidth: 1, borderColor: colors.borderHard },
  buttonLabel: { ...type.label, fontFamily: fonts.label },
  notice: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
    alignItems: "center",
  },
  loading: { paddingVertical: space.xxl, alignItems: "center" },
  pill: {
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    alignSelf: "flex-start",
  },
  pillLabel: { ...type.label, fontSize: 9 },
});
