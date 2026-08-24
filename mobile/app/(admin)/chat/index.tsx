import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, BellOff } from "lucide-react-native";
import { isToday, isPast } from "date-fns";

import { api } from "@/lib/api";
import { formatGigDate, formatGigTime } from "@/lib/dates";
import { colors, space, stroke } from "@/lib/theme";
import { Body, Caption, Eyebrow, Loading, Notice, Title } from "@/components/ui";
import type { RouterOutputs } from "@/lib/api";

/**
 * Which room.
 *
 * Tonight first, then what is coming, then what is still warm. A room drops off
 * the bottom a week after its gig rather than being closed by hand, so nobody
 * has to decide when a night is over and no room is shut while the load-out is
 * still going.
 *
 * An admin is in every room, so for most of the team this is simply the gig
 * list with unread counts on it.
 */

/** Slower than the room itself. This screen answers "is anything happening". */
const POLL_MS = 20000;

type Room = RouterOutputs["gigChat"]["rooms"][number];

export default function ChatRoomsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [focused, setFocused] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const rooms = api.gigChat.rooms.useQuery(undefined, {
    retry: false,
    refetchInterval: focused ? POLL_MS : false,
  });

  const all = rooms.data ?? [];
  const tonight = all.filter((room) => isToday(room.gigStartTime));
  const upcoming = all.filter(
    (room) => !isToday(room.gigStartTime) && !isPast(room.gigStartTime),
  );
  const recent = all
    .filter((room) => !isToday(room.gigStartTime) && isPast(room.gigStartTime))
    .reverse();

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
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft color={colors.text} size={22} strokeWidth={2.5} />
        </Pressable>
        <Title>Rooms</Title>
      </View>

      {rooms.isPending ? <Loading label="Loading rooms" /> : null}

      {rooms.isError ? (
        <Notice
          title="Not available"
          detail="Gig rooms are for admins and whoever is on a gig's notify list."
        />
      ) : null}

      {rooms.isSuccess && all.length === 0 ? (
        <Notice
          title="No rooms"
          detail="A room appears here for every gig you are on. Nothing is coming up."
        />
      ) : null}

      <Section label="Tonight" rooms={tonight} />
      <Section label="Coming up" rooms={upcoming} />
      <Section label="Recent" rooms={recent} />
    </ScrollView>
  );
}

function Section({ label, rooms }: { label: string; rooms: Room[] }) {
  const router = useRouter();
  if (rooms.length === 0) return null;

  return (
    <View style={{ gap: space.xs }}>
      <Eyebrow>{label}</Eyebrow>
      {rooms.map((room) => (
        <Pressable
          key={room.id}
          onPress={() =>
            router.push({
              pathname: "/(admin)/chat/[gigId]",
              params: { gigId: room.id },
            })
          }
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Body numberOfLines={1} style={{ fontWeight: "700" }}>
              {room.title}
            </Body>
            <Caption numberOfLines={1} style={{ marginTop: 2 }}>
              {room.lastMessage
                ? `${room.lastMessage.author}: ${room.lastMessage.body}`
                : "No messages yet"}
            </Caption>
          </View>

          <View style={styles.right}>
            <Text style={styles.when}>
              {room.lastMessage
                ? isToday(room.lastMessage.createdAt)
                  ? formatGigTime(room.lastMessage.createdAt)
                  : formatGigDate(room.lastMessage.createdAt)
                : formatGigDate(room.gigStartTime)}
            </Text>
            {room.unread > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{room.unread}</Text>
              </View>
            ) : room.muted ? (
              <BellOff color={colors.textFaint} size={13} strokeWidth={2.5} />
            ) : null}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: space.md },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: stroke.hair,
    borderBottomColor: colors.border,
  },
  right: { alignItems: "flex-end", gap: space.xs },
  when: { color: colors.textFaint, fontSize: 10.5, fontFamily: "Menlo" },
  badge: {
    minWidth: 19,
    alignItems: "center",
    backgroundColor: colors.text,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeText: { color: "#000", fontSize: 10.5, fontWeight: "900" },
});
