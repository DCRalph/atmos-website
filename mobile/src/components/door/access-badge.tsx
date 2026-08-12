import { StyleSheet, Text, View } from "react-native";

import { accessLevel, isElevated } from "~/lib/ticketing/access-levels";
import { space } from "@/lib/theme";

/**
 * What a ticket gets you past, at the door.
 *
 * The web scanner has carried this on every result, row and sheet for a while;
 * the app showed it nowhere, so an AAA and a general admission looked identical
 * to whoever was actually working the door.
 *
 * Colours come from the levels table rather than a class name, so a level
 * recoloured in admin changes here on the next load. Solid rather than tinted
 * because a scan result paints its own green, amber or red behind this, and the
 * badge has to stay readable on all three.
 */
export function AccessBadge({
  level,
  size = "large",
  /** Hide general admission, which is most tickets and says nothing useful. */
  onlyElevated = false,
}: {
  level: string;
  size?: "large" | "small";
  onlyElevated?: boolean;
}) {
  if (onlyElevated && !isElevated(level)) return null;

  const meta = accessLevel(level);
  const large = size === "large";

  return (
    <View
      style={[
        styles.badge,
        large ? styles.large : styles.small,
        { backgroundColor: meta.badgeBg },
      ]}
    >
      <Text
        style={[
          styles.label,
          large ? styles.labelLarge : styles.labelSmall,
          { color: meta.badgeFg },
        ]}
      >
        {meta.short}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: "flex-start" },
  large: { paddingHorizontal: space.md, paddingVertical: 6 },
  small: { paddingHorizontal: space.sm, paddingVertical: 2 },
  label: { fontWeight: "900", letterSpacing: 1.4 },
  labelLarge: { fontSize: 17 },
  labelSmall: { fontSize: 10 },
});
