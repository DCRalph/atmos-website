import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";

import type { RouterOutputs } from "@/lib/api";
import { colors, radius, space, type } from "@/lib/theme";
import { Caption, IconButton } from "@/components/ui";
import { Glass } from "@/components/glass";
import { OfflineBanner } from "@/components/door/offline-banner";

type Summary = RouterOutputs["door"]["summary"];
type Mode = "scan" | "manual" | "list" | "sell" | "check" | "id" | "activity";

const MODES: { key: Mode; label: string; path: string }[] = [
  { key: "scan", label: "Scan", path: "scan" },
  { key: "manual", label: "Manual", path: "manual" },
  { key: "list", label: "List", path: "list" },
  { key: "sell", label: "Sell", path: "sell" },
  // The one tab that decides nothing: looks a ticket up and records no scan.
  { key: "check", label: "Check", path: "check" },
  // The other half of the door: everything else here decides about a ticket,
  // this one decides about the person holding it.
  { key: "id", label: "ID", path: "id" },
  // A door with no log is a door that cannot answer "what happened ten
  // minutes ago", hence the short label rather than dropping it.
  { key: "activity", label: "Log", path: "activity" },
];

/**
 * The bar every door screen wears: who is in, out of how many, and the ways
 * to admit somebody. The headcount is the number staff are asked for all
 * night, so it stays on screen rather than living behind a tab.
 *
 * `overlay` floats it as glass over the scanner's camera, the one door screen
 * with imagery behind it; everywhere else it sits on black.
 */
export function DoorHeader({
  eventId,
  summary,
  active,
  onBack,
  overlay,
}: {
  eventId: string;
  summary: Summary | undefined;
  active: Mode;
  onBack?: () => void;
  overlay?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const admitted = summary?.admitted ?? 0;
  const sold = summary?.sold ?? 0;
  const percent = sold > 0 ? (admitted / sold) * 100 : 0;

  const content = (
    <>
      {/* Above everything: losing signal changes what the door can do at all,
          so it outranks the headcount for attention. */}
      <View style={styles.banner}>
        <OfflineBanner />
      </View>

      <View style={styles.top}>
        <IconButton
          label="Back"
          icon={ArrowLeft}
          onPress={onBack ?? (() => router.back())}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={styles.event}>
            {summary?.event.name ?? "Door"}
          </Text>
          <Caption numberOfLines={1} style={{ marginTop: 3 }}>
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
          <Text style={styles.countLabel}>
            {summary?.notArrived ?? 0} to come
          </Text>
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
    </>
  );

  return overlay ? (
    <Glass dark style={[styles.wrap, styles.overlay, { paddingTop: insets.top + space.sm }]}>
      {content}
    </Glass>
  ) : (
    <View style={[styles.wrap, styles.solid, { paddingTop: insets.top + space.sm }]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    gap: space.md,
  },
  solid: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  banner: { marginHorizontal: -space.lg },
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
  track: {
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: colors.in },
  /**
   * Wraps rather than cramming.
   *
   * Seven modes across a phone leaves ~50pt each, which is below a comfortable
   * tap target and forces the labels down to unreadable. `flexBasis` is set so
   * the row breaks into short rows of full-width pills on a phone, while a
   * wider screen still lays them all out in one line. Every mode stays one
   * tap away, which matters more at a door than a tidy single row.
   */
  modes: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  mode: {
    flexGrow: 1,
    flexBasis: 72,
    height: 36,
    paddingHorizontal: 2,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  modeActive: { backgroundColor: colors.text },
  modeLabel: { ...type.label, fontSize: 10, color: colors.textSoft },
});
