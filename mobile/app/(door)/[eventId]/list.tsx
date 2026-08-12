import { useEffect, useState } from "react";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from "react-native";

import { api } from "@/lib/api";
import { labelArg, useDeviceLabel } from "@/lib/device-label";
import { colors, radius, space } from "@/lib/theme";
import { formatTimeAgo } from "@/lib/dates";
import { Body, Button, Caption, Loading, Notice, Pill } from "@/components/ui";
import { DoorHeader } from "@/components/door/door-header";
import { ScanResult, type ScanOutcome } from "@/components/door/scan-result";
import { PersonSheet } from "@/components/door/person-sheet";

/**
 * The door list — the fallback for somebody with a dead phone, a name on the
 * guest list and a lot of confidence.
 *
 * Admitting from here goes through the same scan path as the camera, so it
 * gets the same duplicate check and the same full-screen answer. A silent
 * "admitted" is how a stranger walks in on a used ticket.
 */
export default function DoorListScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [onlyNotArrived, setOnlyNotArrived] = useState(false);
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);

  // A door list runs to hundreds of rows; re-querying on every keystroke of a
  // name typed at arm's length is a lot of round trips for no benefit.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const { deviceLabel } = useDeviceLabel();

  const summary = api.door.summary.useQuery(
    { eventId },
    { enabled: !!eventId, refetchInterval: 15_000 },
  );
  const utils = api.useUtils();

  const list = api.door.doorList.useInfiniteQuery(
    { eventId, search: debounced, onlyNotArrived },
    {
      enabled: !!eventId,
      getNextPageParam: (page) => page.nextCursor ?? undefined,
    },
  );

  const admit = api.door.admitByTicketNumber.useMutation({
    onSuccess: async (result) => {
      setOpenTicketId(null);
      setOutcome(result as ScanOutcome);
      await Haptics.notificationAsync(
        result.admit
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      );
      void summary.refetch();
      void utils.door.doorList.invalidate();
      void utils.door.orderTickets.invalidate();
    },
  });

  const rows = list.data?.pages.flatMap((page) => page.rows) ?? [];
  const total = list.data?.pages[0]?.total ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <DoorHeader eventId={eventId} summary={summary.data} active="list" />

      <View style={{ padding: space.lg, gap: space.md }}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Name, email or order number"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.search}
        />
        <View style={styles.filterRow}>
          <View style={styles.filter}>
            <Switch
              value={onlyNotArrived}
              onValueChange={setOnlyNotArrived}
              trackColor={{ true: colors.in, false: colors.surfaceRaised }}
            />
            <Caption>Not arrived only</Caption>
          </View>
          {!list.isPending && (
            <Caption>
              {rows.length < total ? `${rows.length} of ${total}` : `${total}`}
            </Caption>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.lg,
          paddingBottom: space.xxl,
          gap: space.sm,
        }}
      >
        {list.isPending ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Notice
            title={
              debounced
                ? "Nobody matches that"
                : onlyNotArrived
                  ? "Everyone is already in"
                  : "No tickets sold yet"
            }
          />
        ) : (
          rows.map((row) => (
            <View key={row.id} style={styles.row}>
              <Pressable
                onPress={() => setOpenTicketId(row.id)}
                style={{ flex: 1, minWidth: 0, gap: 2 }}
              >
                <Body numberOfLines={1} style={{ fontWeight: "600" }}>
                  {row.attendeeName ?? row.buyerName ?? "No name given"}
                </Body>
                <Caption numberOfLines={1}>
                  {row.tierName} · {row.ticketNumber}
                  {row.isComp ? " · comp" : ""}
                </Caption>
                {row.admittedAt ? (
                  <Caption style={{ color: colors.in }}>
                    In {formatTimeAgo(new Date(row.admittedAt))}
                  </Caption>
                ) : null}
              </Pressable>

              {row.admittedAt ? (
                <Pill tone="in">IN</Pill>
              ) : (
                <Pressable
                  onPress={() =>
                    admit.mutate({
                      eventId,
                      ticketNumber: row.ticketNumber,
                      deviceLabel: labelArg(deviceLabel),
                    })
                  }
                  disabled={admit.isPending}
                  style={styles.admit}
                >
                  <Caption style={{ color: colors.text, fontWeight: "700" }}>
                    Admit
                  </Caption>
                </Pressable>
              )}
            </View>
          ))
        )}

        {list.hasNextPage ? (
          <Button
            variant="outline"
            onPress={() => void list.fetchNextPage()}
            loading={list.isFetchingNextPage}
          >
            {`Show more (${total - rows.length} to go)`}
          </Button>
        ) : null}
      </ScrollView>

      {openTicketId ? (
        <PersonSheet
          eventId={eventId}
          ticketId={openTicketId}
          isManager={summary.data?.isManager ?? false}
          onClose={() => setOpenTicketId(null)}
          onAdmit={(ticketNumber) =>
            admit.mutate({
              eventId,
              ticketNumber,
              deviceLabel: labelArg(deviceLabel),
            })
          }
        />
      ) : null}

      {outcome ? (
        <ScanResult
          eventId={eventId}
          outcome={outcome}
          isManager={summary.data?.isManager ?? false}
          onDismiss={() => setOutcome(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
    color: colors.text,
    fontSize: 16,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  filter: { flexDirection: "row", alignItems: "center", gap: space.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  admit: {
    borderWidth: 2,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
});
