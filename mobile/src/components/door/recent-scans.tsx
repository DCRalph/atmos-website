import { StyleSheet, View } from "react-native";

import { api } from "@/lib/api";
import { colors, radius, space } from "@/lib/theme";
import { formatTimeAgo } from "@/lib/dates";
import { Body, Caption, Eyebrow } from "@/components/ui";

/** Scan results that mean the person got in. */
const ADMITTING = new Set(["ADMITTED", "OVERRIDE_ADMITTED", "REENTRY"]);

/**
 * The last few scans, on the scanner screen.
 *
 * Answers "did that go through?" and "who just let someone in?" without
 * leaving the camera. It refreshes on a timer because at a busy door the
 * useful version of this is the one from ten seconds ago, not from whenever
 * the screen was opened.
 */
export function RecentScans({ eventId }: { eventId: string }) {
  const scans = api.door.recentScans.useQuery(
    { eventId, limit: 8 },
    { enabled: !!eventId, refetchInterval: 10_000 },
  );

  const rows = scans.data ?? [];
  if (rows.length === 0) return null;

  return (
    <View style={{ gap: space.sm }}>
      <Eyebrow>Just now</Eyebrow>
      <View style={styles.list}>
        {rows.map((scan) => {
          const good = ADMITTING.has(scan.result);
          return (
            <View key={scan.id} style={styles.row}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: good ? colors.in : colors.warn },
                ]}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Body numberOfLines={1} style={{ fontSize: 14 }}>
                  {scan.ticket?.attendeeName ??
                    scan.ticket?.ticketNumber ??
                    "Unknown code"}
                </Body>
                <Caption numberOfLines={1}>
                  {[
                    scan.result.replace(/_/g, " ").toLowerCase(),
                    scan.scannedByName,
                    scan.deviceLabel,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Caption>
              </View>
              <Caption>{formatTimeAgo(new Date(scan.createdAt))}</Caption>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dot: { width: 8, height: 8 },
});
