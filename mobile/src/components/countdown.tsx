import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, radius, space, type } from "@/lib/theme";
import { Glass } from "@/components/glass";

/** Seconds left until `target`, ticking once a second. */
function useSecondsUntil(target: Date) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return Math.max(0, Math.floor((target.getTime() - now) / 1000));
}

/** Days / hrs / min / sec as glass tiles. Only used over imagery. */
export function CountdownTiles({ target }: { target: Date }) {
  const total = useSecondsUntil(target);
  const cells = [
    ["Days", Math.floor(total / 86400)],
    ["Hrs", Math.floor((total % 86400) / 3600)],
    ["Min", Math.floor((total % 3600) / 60)],
    ["Sec", total % 60],
  ] as const;

  return (
    <View
      style={styles.row}
      accessibilityRole="timer"
      accessibilityLabel={`${cells[0][1]} days, ${cells[1][1]} hours and ${cells[2][1]} minutes until doors`}
    >
      {cells.map(([label, value], i) => (
        <Glass key={label} style={styles.tile}>
          <Text style={[styles.value, i === 0 && { color: colors.accent }]}>
            {String(value).padStart(2, "0")}
          </Text>
          <Text style={styles.label}>{label}</Text>
        </Glass>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 6 },
  tile: {
    flex: 1,
    height: 64,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  value: {
    ...type.display,
    fontSize: 24,
    lineHeight: 26,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  label: {
    ...type.label,
    fontSize: 8,
    color: colors.textSoft,
    marginTop: space.xs,
  },
});
