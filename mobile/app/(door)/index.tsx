import { Link, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/lib/api";
import { colors, radius, space } from "@/lib/theme";
import { formatGigDate, formatGigTime } from "@/lib/dates";
import {
  Body,
  Button,
  Caption,
  Eyebrow,
  Loading,
  Notice,
  Pill,
  Title,
} from "@/components/ui";

/**
 * Pick a door.
 *
 * `door.myEvents` already returns exactly the events this person may scan —
 * every event for an admin or organiser, otherwise the ones they are rostered
 * on. No new permission logic here, deliberately: a second implementation is a
 * second thing to drift.
 */
export default function DoorPickerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const events = api.door.myEvents.useQuery(undefined, { retry: false });

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
      <View style={{ gap: space.xs }}>
        <Eyebrow>Door mode</Eyebrow>
        <Title>Tonight</Title>
      </View>

      {events.isPending ? (
        <Loading />
      ) : events.isError ? (
        <Notice
          title="You're not on the door"
          detail="Ask an organiser to add you to this event's door staff."
          action={
            <Button variant="outline" onPress={() => router.replace("/(tabs)")}>
              Back to Atmos
            </Button>
          }
        />
      ) : (events.data?.length ?? 0) === 0 ? (
        <Notice
          title="No events to scan"
          detail="Doors appear here from 24 hours before the event starts."
        />
      ) : (
        events.data?.map((event) => (
          <Link
            key={event.id}
            href={{
              pathname: "/(door)/[eventId]/scan",
              params: { eventId: event.id },
            }}
            asChild
          >
            <Pressable
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
            >
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <Caption>
                  {formatGigDate(event.startsAt)} ·{" "}
                  {formatGigTime(event.doorsAt ?? event.startsAt)} doors
                </Caption>
                <Body numberOfLines={1} style={{ fontWeight: "700" }}>
                  {event.name}
                </Body>
                {event.venueName ? (
                  <Caption numberOfLines={1}>{event.venueName}</Caption>
                ) : null}
              </View>
              {event.isR18 ? <Pill tone="warn">R18</Pill> : null}
            </Pressable>
          </Link>
        ))
      )}

      <Pressable onPress={() => router.replace("/(tabs)")} hitSlop={8}>
        <Caption style={{ textAlign: "center" }}>Leave door mode</Caption>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
});
