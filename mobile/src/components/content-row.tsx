import * as WebBrowser from "expo-web-browser";
import { Pressable, StyleSheet, View } from "react-native";

import { Body, Caption } from "@/components/ui";
import { colors, radius, space } from "@/lib/theme";
import { formatGigDate } from "@/lib/dates";

export type ContentRowData = {
  id: string;
  type: string;
  title: string;
  dj: string | null;
  platform: string | null;
  date: Date;
  link: string;
};

/**
 * A mix, video or post.
 *
 * These all live on somebody else's platform — SoundCloud, YouTube — so the row
 * opens an in-app browser rather than pretending to host the thing. Nothing is
 * gained by wrapping a SoundCloud player in a screen of our own.
 */
export function ContentRow({ item }: { item: ContentRowData }) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => {
        void WebBrowser.openBrowserAsync(item.link, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
          controlsColor: colors.text,
          toolbarColor: colors.bg,
        });
      }}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.badge}>
        <Caption style={{ color: colors.textSoft, fontWeight: "700" }}>
          {item.type.slice(0, 3).toUpperCase()}
        </Caption>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Body numberOfLines={1} style={{ fontWeight: "600" }}>
          {item.title}
        </Body>
        <Caption numberOfLines={1}>
          {[item.dj, item.platform, formatGigDate(item.date)]
            .filter(Boolean)
            .join(" · ")}
        </Caption>
      </View>
      <Caption style={{ color: colors.textFaint }}>›</Caption>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
});
