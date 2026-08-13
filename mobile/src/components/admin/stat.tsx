import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, space, stroke } from "@/lib/theme";
import { Caption, Eyebrow } from "@/components/ui";

/**
 * The reading pieces of the analytics screens.
 *
 * Numbers on a phone held at a door get glanced at, not studied, so a stat is
 * a big figure with a small word under it and nothing else competing. The
 * shapes here are deliberately plain — the interesting part of this screen is
 * the data, and anything decorative would be read as meaning something.
 */

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string | null;
  /** Only where the number itself carries a verdict. Most do not. */
  tone?: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, tone ? { color: tone } : null]}>
        {value}
      </Text>
      <Caption>{label}</Caption>
      {hint ? <Caption style={styles.statHint}>{hint}</Caption> : null}
    </View>
  );
}

/** Two across on a phone, so a figure keeps room to be large. */
export function StatGrid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

export function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: space.sm }}>
      <Eyebrow>{title}</Eyebrow>
      {hint ? <Caption>{hint}</Caption> : null}
      {children}
    </View>
  );
}

/** A labelled line with a figure on the right — the table row of this screen. */
export function LineItem({
  label,
  sub,
  value,
  valueTone,
}: {
  label: string;
  sub?: string | null;
  value: string;
  valueTone?: string;
}) {
  return (
    <View style={styles.line}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={styles.lineLabel}>
          {label}
        </Text>
        {sub ? <Caption numberOfLines={1}>{sub}</Caption> : null}
      </View>
      <Text style={[styles.lineValue, valueTone ? { color: valueTone } : null]}>
        {value}
      </Text>
    </View>
  );
}

/** A proportion, drawn. Used for sell-through and for how full the room is. */
export function MeterBar({
  percent,
  tone = colors.in,
}: {
  percent: number;
  tone?: string;
}) {
  return (
    <View style={styles.track}>
      <View
        style={[
          styles.fill,
          // Clamped: an oversold tier or an over-capacity room would otherwise
          // draw a bar wider than its own container.
          { width: `${Math.max(0, Math.min(100, percent))}%`, backgroundColor: tone },
        ]}
      />
    </View>
  );
}

/**
 * The arrival curve, as bars.
 *
 * A chart library for this would be a dependency and a bundle for one shape
 * that is only ever read as "is the rush now, or was it half an hour ago".
 * Bars scaled to the busiest bucket answer that.
 */
export function MiniBars({
  values,
  tone = colors.in,
}: {
  values: number[];
  tone?: string;
}) {
  const max = Math.max(1, ...values);
  return (
    <View style={styles.bars}>
      {values.map((value, index) => (
        <View
          key={index}
          style={[
            styles.bar,
            {
              // A floor of 2%, so an empty five minutes still reads as a
              // bucket that existed rather than a gap in the axis.
              height: `${Math.max(2, (value / max) * 100)}%`,
              backgroundColor: value > 0 ? tone : colors.border,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  stat: {
    flexGrow: 1,
    flexBasis: 150,
    padding: space.md,
    borderWidth: stroke.hair,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 2,
  },
  statValue: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  statHint: { color: colors.textFaint },
  line: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: stroke.hair,
    borderBottomColor: colors.border,
  },
  lineLabel: { color: colors.text, fontSize: 14, fontWeight: "600" },
  lineValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  track: { height: 6, backgroundColor: colors.surfaceRaised, overflow: "hidden" },
  fill: { height: "100%" },
  bars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 1,
    height: 64,
    backgroundColor: colors.surface,
    borderWidth: stroke.hair,
    borderColor: colors.border,
    padding: space.xs,
  },
  bar: { flex: 1, minWidth: 2 },
});
