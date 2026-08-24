import { useCallback, useMemo, useRef, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Bell, BellOff, SendHorizontal } from "lucide-react-native";

import { api } from "@/lib/api";
import { format, isToday } from "date-fns";

import { formatGigDate } from "@/lib/dates";
import { colors, space, stroke, type } from "@/lib/theme";
import { Body, Caption, Loading, Notice } from "@/components/ui";
import {
  Avatar,
  DayMark,
  MessageRow,
  SeenRow,
  type ChatMessage,
} from "@/components/chat/message";
import {
  continuesBlock,
  MAX_MESSAGE_LENGTH,
  REACTIONS,
  receiptAnchorId,
  seenBy,
} from "~/lib/gig-chat/room";

/**
 * A gig's room.
 *
 * Polling, not sockets: the room refetches every few seconds while it is open
 * and stops the moment it is not, which is what `useFocusEffect` below is for.
 * Six people for one night does not justify holding a connection open per
 * member for the length of a shift, and the swap to a `since` cursor or to
 * sockets happens in the router without touching this file.
 *
 * Fetching the room also marks it read, server-side. That is not a shortcut: a
 * fresh read mark is how the server knows somebody is looking at the room and
 * does not need a push for the message that just arrived.
 */

/** Fast enough to feel live, slow enough to be free. */
const POLL_MS = 5000;

export default function ChatRoomScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { gigId } = useLocalSearchParams<{ gigId: string }>();

  const [draft, setDraft] = useState("");
  const [selected, setSelected] = useState<ChatMessage | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const scroller = useRef<ScrollView>(null);

  const utils = api.useUtils();
  const [focused, setFocused] = useState(true);

  // Polling stops when the screen is not the one being looked at. Without this
  // a room left behind on the stack keeps asking all night.
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const room = api.gigChat.room.useQuery(
    { gigId: gigId ?? "" },
    {
      enabled: !!gigId,
      // A refusal is the normal answer for somebody not on this gig, not an
      // error worth retrying.
      retry: false,
      refetchInterval: focused ? POLL_MS : false,
    },
  );

  const refresh = () => {
    void utils.gigChat.room.invalidate({ gigId });
    void utils.gigChat.rooms.invalidate();
    void utils.gigChat.unreadTotal.invalidate();
  };

  const send = api.gigChat.send.useMutation({ onSuccess: refresh });
  const react = api.gigChat.react.useMutation({ onSuccess: refresh });
  const remove = api.gigChat.remove.useMutation({ onSuccess: refresh });
  const setMuted = api.gigChat.setMuted.useMutation({ onSuccess: refresh });

  const messages = useMemo(() => room.data?.messages ?? [], [room.data]);
  // From the server rather than the local session, so "is this mine" is
  // answered by the same call that decided this account may be here at all.
  const viewerId = room.data?.viewerId ?? "";
  const anchorId = receiptAnchorId(messages, viewerId);

  const submit = () => {
    const body = draft.trim();
    if (!body || !gigId || send.isPending) return;
    // Cleared before the round trip. A message that sits in the box while the
    // network thinks about it gets typed twice.
    setDraft("");
    send.mutate({ gigId, body });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft color={colors.text} size={22} strokeWidth={2.5} />
        </Pressable>

        <Pressable
          style={styles.headerText}
          onPress={() => setMembersOpen(true)}
          disabled={!room.data}
        >
          <Text style={styles.headerTitle} numberOfLines={1}>
            {room.data?.gig.title ?? "Room"}
          </Text>
          {room.data ? (
            <Caption>
              {room.data.members.length} in the room ·{" "}
              {formatGigDate(room.data.gig.gigStartTime)}
            </Caption>
          ) : null}
        </Pressable>

        {room.data ? (
          <Pressable
            hitSlop={12}
            onPress={() =>
              gigId && setMuted.mutate({ gigId, muted: !room.data.muted })
            }
          >
            {room.data.muted ? (
              <BellOff color={colors.textFaint} size={19} strokeWidth={2.5} />
            ) : (
              <Bell color={colors.text} size={19} strokeWidth={2.5} />
            )}
          </Pressable>
        ) : null}
      </View>

      {room.isPending ? <Loading label="Opening room" /> : null}

      {room.isError ? (
        <View style={{ padding: space.lg }}>
          <Notice
            title="Not in this room"
            detail="Gig rooms are for admins and whoever is on the gig's notify list."
          />
        </View>
      ) : null}

      {room.data ? (
        <ScrollView
          ref={scroller}
          style={{ flex: 1 }}
          contentContainerStyle={styles.stream}
          onContentSizeChange={() =>
            scroller.current?.scrollToEnd({ animated: false })
          }
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 ? (
            <Notice
              title="Nothing said yet"
              detail="This is the room for the night. Load-in codes, door problems, anything the rest of the team needs."
            />
          ) : null}

          {messages.map((message, index) => {
            const previous = messages[index - 1];
            const next = messages[index + 1];
            const continues = continuesBlock(previous, message);
            const day = dayLabel(message.createdAt);
            const newDay = !previous || dayLabel(previous.createdAt) !== day;

            return (
              <View key={message.id}>
                {newDay ? <DayMark label={day} /> : null}
                <MessageRow
                  message={message}
                  viewerId={viewerId}
                  continues={continues && !newDay}
                  // Only the last message of a block wears the face.
                  showAvatar={!next || !continuesBlock(message, next)}
                  onLongPress={() => setSelected(message)}
                  onToggleReaction={(emoji) =>
                    react.mutate({ messageId: message.id, emoji })
                  }
                />
                {message.id === anchorId ? (
                  <SeenRow {...seenBy(room.data.members, message)} />
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      ) : null}

      {room.data ? (
        <View style={[styles.composer, { paddingBottom: insets.bottom + space.sm }]}>
          <TextInput
            style={styles.field}
            value={draft}
            onChangeText={setDraft}
            placeholder="Message the room"
            placeholderTextColor={colors.textFaint}
            maxLength={MAX_MESSAGE_LENGTH}
            multiline
            onSubmitEditing={submit}
            returnKeyType="send"
          />
          <Pressable
            onPress={submit}
            disabled={draft.trim().length === 0}
            hitSlop={8}
            style={({ pressed }) => [
              styles.send,
              draft.trim().length === 0 && { opacity: 0.35 },
              pressed && { opacity: 0.6 },
            ]}
          >
            <SendHorizontal color="#000" size={18} strokeWidth={2.5} />
          </Pressable>
        </View>
      ) : null}

      {/* Long press. Five reactions and, when it is allowed, a way to take a
          message back. Deliberately not a menu of everything a chat could do. */}
      <Modal
        visible={selected !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setSelected(null)}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
            <View style={styles.reactionBar}>
              {REACTIONS.map((emoji) => (
                <Pressable
                  key={emoji}
                  style={styles.reactionKey}
                  onPress={() => {
                    if (selected) {
                      react.mutate({ messageId: selected.id, emoji });
                    }
                    setSelected(null);
                  }}
                >
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                </Pressable>
              ))}
            </View>

            {selected ? (
              <View style={styles.quoted}>
                <Caption>{selected.author.name}</Caption>
                <Body numberOfLines={3} style={{ marginTop: 2 }}>
                  {selected.body}
                </Body>
              </View>
            ) : null}

            {/* Only where it would work. The server allows the author or an
                admin; drawing it for anybody else is an action that fails. */}
            {selected?.canDelete ? (
              <Pressable
                style={styles.sheetAction}
                onPress={() => {
                  remove.mutate({ messageId: selected.id });
                  setSelected(null);
                }}
              >
                <Text style={styles.deleteText}>Delete message</Text>
              </Pressable>
            ) : null}
          </View>
        </Pressable>
      </Modal>

      {/* Who is here, and who is behind. The second half is the point: read
          receipts are only useful if you can see who is missing. */}
      <Modal
        visible={membersOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMembersOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setMembersOpen(false)}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
            <Text style={styles.sheetTitle}>In the room</Text>
            {room.data?.members.map((member) => {
              const last = messages.at(-1);
              const caughtUp =
                !last ||
                (member.lastReadAt !== null &&
                  member.lastReadAt.getTime() >= last.createdAt.getTime());
              return (
                <View key={member.id} style={styles.memberRow}>
                  <Avatar name={member.name} />
                  <Body style={{ flex: 1 }} numberOfLines={1}>
                    {member.name}
                  </Body>
                  <Caption>
                    {member.lastReadAt === null
                      ? "Never opened"
                      : caughtUp
                        ? "Up to date"
                        : "Behind"}
                  </Caption>
                </View>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

/**
 * The day a message belongs to.
 *
 * Not `formatGigDate`, which says "Tonight" — correct for the gig in the
 * header, wrong as a separator above a message sent at ten in the morning.
 */
function dayLabel(value: Date): string {
  return isToday(value) ? "Today" : format(value, "EEE d MMM");
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    borderBottomWidth: stroke.hair,
    borderBottomColor: colors.border,
  },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.3,
    textTransform: "uppercase",
  },

  stream: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.lg,
  },

  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    borderTopWidth: stroke.hair,
    borderTopColor: colors.border,
  },
  field: {
    flex: 1,
    maxHeight: 120,
    borderWidth: stroke.hair,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: type.body.fontSize,
    paddingHorizontal: space.md - 2,
    paddingVertical: space.sm + 1,
  },
  send: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text,
  },

  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopWidth: stroke.hard,
    borderTopColor: colors.borderHard,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    gap: space.md,
  },
  sheetTitle: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  reactionBar: { flexDirection: "row", gap: space.sm },
  reactionKey: {
    borderWidth: stroke.hair,
    borderColor: colors.borderStrong,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  reactionEmoji: { fontSize: 22 },
  quoted: {
    borderLeftWidth: stroke.hard,
    borderLeftColor: colors.borderStrong,
    paddingLeft: space.md,
  },
  sheetAction: {
    borderTopWidth: stroke.hair,
    borderTopColor: colors.border,
    paddingTop: space.md,
  },
  deleteText: {
    color: colors.deny,
    fontSize: type.body.fontSize,
    fontWeight: "700",
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.xs,
  },
});
