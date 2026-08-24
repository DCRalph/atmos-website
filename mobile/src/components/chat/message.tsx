import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, space, stroke, type } from "@/lib/theme";
import type { RouterOutputs } from "@/lib/api";
import { formatGigTime } from "@/lib/dates";
import { groupReactions } from "~/lib/gig-chat/room";

/**
 * The reading pieces of a room.
 *
 * Bubbles, which is the one shape in this app that is not the site's flat
 * brutalism. That is deliberate: a chat is the one screen where the question is
 * "who said this" before it is "what does it say", and alignment answers that
 * faster than a name can. The bubble itself is still square with a hard edge,
 * so it reads as the same object as everything else.
 */

/**
 * Taken from the router rather than declared again here, so a field added or
 * renamed server-side is a type error in this file rather than something that
 * silently stops rendering.
 */
export type ChatMessage =
  RouterOutputs["gigChat"]["room"]["messages"][number];

/** Initials, because a room of six does not need photographs to tell them apart. */
export function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.42 }]}>
        {initials(name)}
      </Text>
    </View>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

/**
 * One message.
 *
 * `continues` collapses a follow-up thought into the block above it, which
 * costs a name and a timestamp and buys back two lines of a small screen. The
 * avatar is drawn only on the last message of a block, so a run of four sits
 * against one face rather than four copies of it.
 */
export function MessageRow({
  message,
  viewerId,
  continues,
  showAvatar,
  onLongPress,
  onToggleReaction,
}: {
  message: ChatMessage;
  viewerId: string;
  continues: boolean;
  showAvatar: boolean;
  onLongPress: () => void;
  onToggleReaction: (emoji: string) => void;
}) {
  const mine = message.authorId === viewerId;
  const groups = groupReactions(message.reactions, viewerId);

  return (
    <View
      style={[
        styles.row,
        mine && styles.rowMine,
        { marginTop: continues ? space.xs : space.md },
      ]}
    >
      {!mine ? (
        <View style={styles.gutter}>
          {showAvatar ? <Avatar name={message.author.name} /> : null}
        </View>
      ) : null}

      <View style={[styles.column, mine && { alignItems: "flex-end" }]}>
        {!mine && !continues ? (
          <Text style={styles.name}>{message.author.name}</Text>
        ) : null}

        <Pressable
          onLongPress={message.deleted ? undefined : onLongPress}
          delayLongPress={250}
          style={({ pressed }) => [
            styles.bubble,
            mine && styles.bubbleMine,
            message.deleted && styles.bubbleDeleted,
            pressed && !message.deleted && { opacity: 0.7 },
          ]}
        >
          <Text
            style={[styles.body, message.deleted && styles.bodyDeleted]}
            selectable={!message.deleted}
          >
            {message.deleted ? "Message deleted" : message.body}
          </Text>
        </Pressable>

        {groups.length > 0 ? (
          <View style={[styles.reactions, mine && { justifyContent: "flex-end" }]}>
            {groups.map((group) => (
              <Pressable
                key={group.emoji}
                onPress={() => onToggleReaction(group.emoji)}
                hitSlop={6}
                style={[styles.chip, group.mine && styles.chipMine]}
              >
                <Text style={styles.chipEmoji}>{group.emoji}</Text>
                <Text style={[styles.chipCount, group.mine && styles.chipCountMine]}>
                  {group.count}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <Text style={styles.time}>{formatGigTime(message.createdAt)}</Text>
      </View>
    </View>
  );
}

/**
 * Who has read the viewer's last message.
 *
 * Drawn once, under the newest message when it is the viewer's own — see
 * `receiptAnchorId`. Receipts on every message is noise; the only question a
 * room actually asks is whether the last thing you said landed.
 */
export function SeenRow({ names, total }: { names: string[]; total: number }) {
  if (total === 0) return null;

  return (
    <View style={styles.seen}>
      <Text style={styles.seenText}>
        {names.length === 0
          ? "Sent"
          : names.length === total
            ? "Seen by everyone"
            : `Seen by ${names.length} of ${total}`}
      </Text>
      {names.length > 0 ? (
        <View style={styles.stack}>
          {names.slice(0, 3).map((name, index) => (
            <View key={name} style={index > 0 ? styles.stacked : null}>
              <Avatar name={name} size={17} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** The day a run of messages belongs to. Only drawn when it changes. */
export function DayMark({ label }: { label: string }) {
  return (
    <View style={styles.day}>
      <View style={styles.rule} />
      <Text style={styles.dayText}>{label}</Text>
      <View style={styles.rule} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", gap: space.sm },
  rowMine: { justifyContent: "flex-end" },
  /* Held open on a continuation so a block stays aligned with its avatar. */
  gutter: { width: 24 },
  column: { maxWidth: "78%", minWidth: 0 },

  avatar: {
    borderWidth: stroke.hair,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.textSoft, fontWeight: "900", letterSpacing: 0.4 },

  name: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: 3,
  },

  bubble: {
    borderWidth: stroke.hair,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingVertical: space.sm,
    paddingHorizontal: space.md - 2,
  },
  bubbleMine: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderHard,
  },
  bubbleDeleted: { backgroundColor: "transparent", borderStyle: "dashed" },
  body: { color: colors.text, fontSize: type.body.fontSize, lineHeight: 21 },
  bodyDeleted: { color: colors.textFaint, fontStyle: "italic" },

  reactions: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 5 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: stroke.hair,
    borderColor: colors.borderStrong,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  chipMine: {
    borderColor: colors.borderHard,
    backgroundColor: colors.surfaceRaised,
  },
  chipEmoji: { fontSize: 12 },
  chipCount: { color: colors.textFaint, fontSize: 10.5, fontWeight: "700" },
  chipCountMine: { color: colors.textSoft },

  time: {
    color: colors.textFaint,
    fontSize: 10,
    fontFamily: "Menlo",
    marginTop: 3,
  },

  seen: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    marginTop: space.xs,
  },
  seenText: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  stack: { flexDirection: "row" },
  /* Overlapped, so four faces cost the width of two. */
  stacked: { marginLeft: -5 },

  day: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginTop: space.lg,
    marginBottom: space.xs,
  },
  rule: { flex: 1, height: 1, backgroundColor: colors.border },
  dayText: {
    color: colors.textFaint,
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
});
