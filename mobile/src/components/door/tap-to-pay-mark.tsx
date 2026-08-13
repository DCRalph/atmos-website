import { SymbolView } from "expo-symbols";
import { CreditCard } from "lucide-react-native";
import type { StyleProp, ViewStyle } from "react-native";

import { colors } from "@/lib/theme";

/**
 * The Tap to Pay contactless mark.
 *
 * App Review checklist 5.5 is specific: when the button carries iconography, it
 * must be `wave.3.right.circle` or `wave.3.right.circle.fill` from SF Symbols —
 * not something that looks like them. Rendering the real system symbol through
 * `expo-symbols` is the only way to satisfy that; a hand-drawn SVG replica of
 * an Apple symbol is both a redraw of their artwork and a review risk.
 *
 * The fallback only ever renders off iOS, where Tap to Pay on iPhone does not
 * apply in the first place.
 */
export function TapToPayMark({
  size = 22,
  color = colors.text,
  filled = true,
  style,
}: {
  size?: number;
  color?: string;
  filled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <SymbolView
      name={filled ? "wave.3.right.circle.fill" : "wave.3.right.circle"}
      size={size}
      tintColor={color}
      type="monochrome"
      style={[{ width: size, height: size }, style]}
      fallback={<CreditCard color={color} size={size} strokeWidth={2} />}
    />
  );
}
