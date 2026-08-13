import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";

import type { RouterOutputs } from "@/lib/api";
import { colors, space } from "@/lib/theme";
import { Caption } from "@/components/ui";
import { OfflineBanner } from "@/components/door/offline-banner";

type Summary = RouterOutputs["door"]["summary"];
type Mode = "scan" | "manual" | "list" | "sell" | "check" | "activity";

const MODES: { key: Mode; label: string; path: string }[] = [
  { key: "scan", label: "Scan", path: "scan" },
  { key: "manual", label: "Manual", path: "manual" },
  { key: "list", label: "List", path: "list" },
  { key: "sell", label: "Sell", path: "sell" },
  // The one tab that decides nothing: looks a ticket up and records no scan.
  { key: "check", label: "Check", path: "check" },
  // A door with no log is a door that cannot answer "what happened ten
  // minutes ago", hence the short label rather than dropping it.
  { key: "activity", label: "Log", path: "activity" },
];

/**
 * The bar every door screen wears: who is in, out of how many, and the four
 * ways to admit somebody. The headcount is the number staff are asked for all
 * night, so it stays on screen rather than living behind a tab.
 */
export function DoorHeader({
  eventId,
  summary,
  active,
  onBack,
}: {
  eventId: string;
  summary: Summary | undefined;
  active: Mode;
  onBack?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const admitted = summary?.admitted ?? 0;
  const sold = summary?.sold ?? 0;
  const percent = sold > 0 ? (admitted / sold) * 100 : 0;

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + space.sm }]}>
      {/* Above everything: losing signal changes what the door can do at all,
          so it outranks the headcount for attention. */}
      <View style={styles.banner}>
        <OfflineBanner />
      </View>

      <View style={styles.top}>
        <Pressable onPress={onBack ?? (() => router.back())} hitSlop={12}>
          <ArrowLeft color={colors.text} size={22} strokeWidth={2.5} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={styles.event}>
            {summary?.event.name ?? "Door"}
          </Text>
          <Caption numberOfLines={1}>
            {[
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
          <Caption>{summary?.notArrived ?? 0} to come</Caption>
        </View>
      </View>

      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityValue={{ now: admitted, max: sold }}
      >
        <View style={[styles.fill, { width: `${percent}%` }]} />
      </View>

      <View style={styles.modes}>
        {MODES.map((mode) => (
          <Pressable
            key={mode.key}
            onPress={() =>
              router.replace({
                pathname: `/(door)/[eventId]/${mode.path}` as never,
                params: { eventId },
              })
            }
            style={[styles.mode, active === mode.key && styles.modeActive]}
          >
            <Text
              style={[
                styles.modeLabel,
                active === mode.key && { color: "#000" },
              ]}
            >
              {mode.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    gap: space.sm,
  },
  banner: { marginHorizontal: -space.lg },
  top: { flexDirection: "row", alignItems: "center", gap: space.md },
  event: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  count: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  countTotal: { color: colors.textFaint, fontSize: 14, fontWeight: "400" },
  track: {
    height: 3,
    backgroundColor: colors.surfaceRaised,
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: colors.in },
  /**
   * Wraps rather than cramming.
   *
   * Six modes across a phone leaves ~50pt each, which is below a comfortable
   * tap target and forces the labels down to unreadable. `flexBasis` is set so
   * the row breaks after three on a phone — a 3x2 grid of full-width buttons —
   * while a wider screen still lays all six out in one line. Every mode stays
   * one tap away, which matters more at a door than a tidy single row.
   */
  modes: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  mode: {
    flexGrow: 1,
    flexBasis: 92,
    height: 40,
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.border,
  },
  modeActive: { backgroundColor: colors.text, borderColor: colors.text },
  modeLabel: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});
