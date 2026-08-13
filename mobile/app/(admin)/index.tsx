import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";

import { api } from "@/lib/api";
import { formatNZD } from "~/lib/ticketing/money";
import { formatGigDateLong } from "@/lib/dates";
import { colors, radius, space, stroke } from "@/lib/theme";
import { Body, Caption, Loading, Notice, Pill, Title } from "@/components/ui";
import { MeterBar } from "@/components/admin/stat";

/**
 * Which event.
 *
 * Ordered newest first, the same as the web organiser list, because the event
 * somebody opens on a phone is nearly always the one happening tonight or the
 * one that just finished. Sell-through is on the row itself — it is the single
 * number that decides whether the event needs attention at all.
 */
export default function AdminEventsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const events = api.ticketEvents.list.useQuery(
    { includeArchived: false },
    // A refusal is the normal answer for anyone who is not an organiser, not
    // an error worth retrying.
    { retry: false },
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + space.lg,
        paddingBottom: space.xxl,
        paddingHorizontal: space.lg,
        gap: space.lg,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft color={colors.text} size={22} strokeWidth={2.5} />
        </Pressable>
        <Title>Events</Title>
      </View>

      {events.isPending ? <Loading label="Loading events" /> : null}

      {events.isError ? (
        <Notice
          title="Not an organiser"
          detail="This area is for event organisers. If that should be you, ask an admin to grant the permission."
        />
      ) : null}

      {events.data?.length === 0 ? (
        <Notice title="No events yet" detail="Create one on the web admin." />
      ) : null}

      {events.data?.map((event) => {
        const percent =
          event.totalAllocation > 0
            ? Math.round((event.totalSold / event.totalAllocation) * 100)
            : 0;
        const revenueCents = event.tiers.reduce(
          (sum, tier) => sum + tier.soldCount * tier.priceCents,
          0,
        );

        return (
          <Pressable
            key={event.id}
            onPress={() =>
              router.push({
                pathname: "/(admin)/[eventId]",
                params: { eventId: event.id },
              })
            }
            style={styles.row}
          >
            <View style={styles.rowTop}>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text numberOfLines={2} style={styles.name}>
                  {event.name}
                </Text>
                <Caption numberOfLines={1}>
                  {formatGigDateLong(event.startsAt)}
                  {event.venueName ? ` · ${event.venueName}` : ""}
                </Caption>
              </View>
              {event.status !== "PUBLISHED" ? (
                <Pill tone={event.status === "CANCELLED" ? "deny" : "warn"}>
                  {event.status}
                </Pill>
              ) : null}
            </View>

            <MeterBar percent={percent} />

            <View style={styles.rowBottom}>
              <Body soft>
                {event.totalSold}/{event.totalAllocation} sold · {percent}%
              </Body>
              <Body style={{ fontWeight: "800" }}>
                {formatNZD(revenueCents)}
              </Body>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    borderWidth: stroke.hard,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: space.lg,
    gap: space.sm,
  },
  rowTop: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  rowBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
  },
  name: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
});
