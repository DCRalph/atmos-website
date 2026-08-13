import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { api } from "@/lib/api";
import { colors, space, stroke } from "@/lib/theme";
import { formatTimeAgo } from "@/lib/dates";
import { denyReasonLabel } from "~/lib/ticketing/deny-reasons";
import { scanResultLabel } from "~/lib/ticketing/scan-results";
import { scanToneColor } from "@/lib/scan-tone";
import { Body, Caption, Loading, Notice } from "@/components/ui";
import { DoorHeader } from "@/components/door/door-header";
import { PersonSheet } from "@/components/door/person-sheet";

/**
 * What has happened on this door.
 *
 * The scan tab's recent list answers "what did I just do" for one phone. This
 * is the question a manager asks instead — what happened across every door in
 * the last ten minutes, and who did it — which nothing answered before. Rows
 * open the person, because "what happened" is always followed by "and who was
 * that".
 */

const FILTERS = [
  ["all", "All"],
  ["refused", "Refused"],
  ["overrides", "Overrides"],
  ["notes", "Notes"],
] as const;

export default function ActivityScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const [filter, setFilter] =
    useState<(typeof FILTERS)[number][0]>("all");
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);

  const summary = api.door.summary.useQuery(
    { eventId },
    { enabled: !!eventId, refetchInterval: 15_000 },
  );
  // Polled: this is the screen somebody leaves open on the shelf behind the
  // door, and a feed that only moves when you pull it is not a feed.
  const feed = api.door.activity.useQuery(
    { eventId, filter },
    { enabled: !!eventId, refetchInterval: 10_000 },
  );

  const rows = feed.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <DoorHeader eventId={eventId} summary={summary.data} active="activity" />

      <View style={styles.filters}>
        {FILTERS.map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => setFilter(value)}
            style={[styles.chip, filter === value && styles.chipOn]}
          >
            <Text
              style={[styles.chipLabel, filter === value && { color: "#000" }]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.lg,
          paddingBottom: space.xxl,
          gap: space.sm,
        }}
      >
        {feed.isPending ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Notice
            title={
              filter === "all" ? "Nothing yet tonight" : "Nothing under that"
            }
            detail="Scans appear here as they happen, from every door."
          />
        ) : (
          rows.map((row) => {
            const tone = scanToneColor(row.result);
            const name =
              row.ticket?.attendeeName ?? row.ticket?.ticketNumber ?? null;
            return (
              <Pressable
                key={row.id}
                disabled={!row.ticket}
                onPress={() =>
                  row.ticket ? setOpenTicketId(row.ticket.id) : undefined
                }
                style={styles.row}
              >
                <View style={[styles.dot, { backgroundColor: tone }]} />
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Body
                    numberOfLines={1}
                    style={{ fontWeight: "700", color: tone }}
                  >
                    {scanResultLabel(row.result)}
                    {name ? ` · ${name}` : ""}
                  </Body>
                  {row.reason || row.note ? (
                    <Caption numberOfLines={2}>
                      {row.reason ? denyReasonLabel(row.reason) : ""}
                      {row.reason && row.note ? " — " : ""}
                      {row.note ?? ""}
                    </Caption>
                  ) : null}
                  <Caption>
                    {formatTimeAgo(row.at)}
                    {row.by ? ` · ${row.by}` : ""}
                    {row.device ? ` · ${row.device}` : ""}
                  </Caption>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {openTicketId ? (
        <PersonSheet
          eventId={eventId}
          ticketId={openTicketId}
          isManager={summary.data?.isManager ?? false}
          onClose={() => setOpenTicketId(null)}
          onAdmit={() => setOpenTicketId(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  filters: {
    flexDirection: "row",
    gap: space.xs,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  chip: {
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderWidth: stroke.hard,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.text, borderColor: colors.text },
  chipLabel: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    gap: space.md,
    padding: space.md,
    backgroundColor: colors.surface,
    borderWidth: stroke.hair,
    borderColor: colors.border,
  },
  dot: { width: 8, height: 8, marginTop: 6 },
});
