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

import { colors, radius, space, stroke, type } from "@/lib/theme";

/** Section marker — the uppercase letterspaced label used across the site. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

export function Title({
  children,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  /** For a title in a header bar, where a long gig name must not wrap. */
  numberOfLines?: number;
}) {
  return (
    <Text numberOfLines={numberOfLines} style={[styles.title, style]}>
      {children}
    </Text>
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

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  children,
  onPress,
  variant = "primary",
  size = "md",
  disabled,
  loading,
  style,
}: {
  children: ReactNode;
  onPress: () => void;
  variant?: "primary" | "outline" | "ghost";
  /** `sm` is for secondary affordances that should not compete with the
      screen's real action — the door entry point on the account card. */
  size?: "sm" | "md";
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const isDisabled = disabled ?? loading;
  const isSmall = size === "sm";
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        isSmall && styles.buttonSmall,
        variant === "primary" && styles.buttonPrimary,
        variant === "outline" && styles.buttonOutline,
        variant === "ghost" && styles.buttonGhost,
        pressed && !isDisabled && { opacity: 0.7 },
        isDisabled && { opacity: 0.45 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size={isSmall ? "small" : undefined}
          color={variant === "primary" ? "#000" : "#fff"}
        />
      ) : (
        <Text
          style={[
            styles.buttonLabel,
            isSmall && styles.buttonLabelSmall,
            variant === "primary" && { color: "#000" },
          ]}
        >
          {children}
        </Text>
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
      <Text style={styles.noticeTitle}>{title}</Text>
      {detail ? <Caption style={{ marginTop: 4 }}>{detail}</Caption> : null}
      {action ? <View style={{ marginTop: space.md }}>{action}</View> : null}
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.textFaint} />
      {label ? <Caption style={{ marginTop: space.sm }}>{label}</Caption> : null}
    </View>
  );
}

/** Coloured status pill — in / warning / refused, plus a neutral. */
export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "in" | "warn" | "deny";
}) {
  const toneStyle = {
    neutral: { bg: colors.surfaceRaised, fg: colors.textSoft },
    in: { bg: colors.inDim, fg: colors.in },
    warn: { bg: colors.warnDim, fg: colors.warn },
    deny: { bg: colors.denyDim, fg: colors.deny },
  }[tone];

  return (
    <View style={[styles.pill, { backgroundColor: toneStyle.bg }]}>
      <Text style={[styles.pillLabel, { color: toneStyle.fg }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    color: colors.textFaint,
    fontSize: type.eyebrow.fontSize,
    fontWeight: type.eyebrow.fontWeight,
    letterSpacing: type.eyebrow.letterSpacing,
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontSize: type.title.fontSize,
    fontWeight: type.title.fontWeight,
    letterSpacing: type.title.letterSpacing,
    textTransform: "uppercase",
  },
  body: { color: colors.text, fontSize: type.body.fontSize },
  caption: { color: colors.textFaint, fontSize: type.caption.fontSize },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: stroke.hair,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  button: {
    height: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.lg,
  },
  buttonSmall: {
    height: 34,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    alignSelf: "flex-start",
  },
  buttonPrimary: { backgroundColor: colors.text },
  // `border-2 border-white/30 bg-transparent`, straight off the site's CTAs.
  buttonOutline: { borderWidth: stroke.hard, borderColor: colors.borderHard },
  buttonGhost: { backgroundColor: "transparent" },
  buttonLabel: {
    color: colors.text,
    fontSize: type.label.fontSize,
    fontWeight: type.label.fontWeight,
    letterSpacing: type.label.letterSpacing,
    textTransform: "uppercase",
  },
  buttonLabelSmall: { fontSize: type.label.fontSize - 2, letterSpacing: 1 },
  notice: {
    borderWidth: stroke.hard,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.xl,
    alignItems: "center",
  },
  noticeTitle: {
    color: colors.text,
    fontSize: type.heading.fontSize,
    fontWeight: type.heading.fontWeight,
    letterSpacing: type.heading.letterSpacing,
    textTransform: "uppercase",
    textAlign: "center",
  },
  loading: { paddingVertical: space.xxl, alignItems: "center" },
  pill: {
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    alignSelf: "flex-start",
  },
  pillLabel: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
});
