import { Link, useRouter } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/lib/api";
import { useDeviceLabel } from "@/lib/device-label";
import { colors, radius, space, stroke, type } from "@/lib/theme";
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
 *
 * Which door this handset is gets named here too, on the way in, rather than
 * on the scanner, whose screen belongs to the camera.
 */
export default function DoorPickerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const events = api.door.myEvents.useQuery(undefined, { retry: false });
  const { deviceLabel, setDeviceLabel } = useDeviceLabel();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + space.lg,
          paddingBottom: space.xl,
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
              <Pressable>
                {({ pressed }) => (
                  <View style={[styles.row, pressed && { opacity: 0.8 }]}>
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
                  </View>
                )}
              </Pressable>
            </Link>
          ))
        )}

        {events.data?.length ? (
          <View style={{ gap: space.sm, marginTop: space.lg }}>
            <Eyebrow>This handset</Eyebrow>
            <TextInput
              value={deviceLabel}
              onChangeText={setDeviceLabel}
              placeholder="Front door"
              placeholderTextColor={colors.textFaint}
              autoCorrect={false}
              style={styles.label}
            />
            <Caption>
              Shows on every scan you take, so the log can tell doors apart.
            </Caption>
          </View>
        ) : null}
      </ScrollView>

      {/* Pinned to the bottom and full width: leaving the door is a deliberate
          act done one-handed, often in the dark, so it gets a real target
          rather than a caption you have to scroll to find. */}
      <View
        style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}
      >
        <Button variant="outline" onPress={() => router.replace("/(tabs)")}>
          Leave door mode
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    backgroundColor: colors.surface,
    borderWidth: stroke.hair,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  label: {
    ...type.body,
    height: 46,
    borderRadius: radius.pill,
    borderWidth: stroke.hair,
    borderColor: colors.borderStrong,
    paddingHorizontal: space.lg,
    color: colors.text,
  },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    backgroundColor: colors.bg,
    borderTopWidth: stroke.hard,
    borderTopColor: colors.border,
  },
});
