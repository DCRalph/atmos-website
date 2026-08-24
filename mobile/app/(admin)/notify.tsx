import { useState } from "react";
import { useRouter } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";

import { api } from "@/lib/api";
import { colors, space, stroke, type } from "@/lib/theme";
import { Body, Button, Caption, Eyebrow, Notice, Title } from "@/components/ui";

/**
 * Telling the team something, from the venue.
 *
 * The case this exists for is a problem at a door: a reader is down, a queue is
 * building, and the person who knows is holding a phone in the dark rather than
 * sitting at the web admin. So the screen is short enough to fill with one
 * thumb, and the audience is named above the button — six handsets, by name —
 * because sending to the wrong topic is the only irreversible thing here.
 *
 * `announcements` is deliberately absent. It reaches every install including
 * punters, and a phone at a door is not where that decision should be made; it
 * is admin-only on the server and lives on the web admin instead.
 */

const TOPICS = [
  { name: "team", label: "Team" },
  { name: "door", label: "Door" },
  { name: "alerts", label: "Alerts" },
] as const;

/** ntfy's 3 and 4. The tiers below 3 are silent, which is not what a door wants. */
const PRIORITIES = [
  { value: 3, label: "Normal" },
  { value: 4, label: "High" },
] as const;

export default function NotifyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [topic, setTopic] = useState<string>("team");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<3 | 4>(4);
  const [sentTo, setSentTo] = useState<number | null>(null);

  // A refusal is the normal answer for anyone who is not an organiser, not an
  // error worth retrying.
  const audience = api.notify.audience.useQuery({ topic }, { retry: false });

  const send = api.notify.send.useMutation({
    onSuccess: (sent) => {
      setSentTo(sent.delivery.delivered);
      setTitle("");
      setMessage("");
    },
  });

  const listening = audience.data?.listening ?? [];
  const canSend = message.trim().length > 0 && !send.isPending;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space.lg,
          paddingBottom: space.xxl,
          paddingHorizontal: space.lg,
          gap: space.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: space.md }}
        >
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ArrowLeft color={colors.text} size={22} strokeWidth={2.5} />
          </Pressable>
          <Title>Notify</Title>
        </View>

        {audience.isError ? (
          <Notice
            title="Not an organiser"
            detail="This area is for event organisers. If that should be you, ask an admin to grant the permission."
          />
        ) : (
          <>
            <View style={styles.row}>
              {TOPICS.map((entry) => {
                const selected = entry.name === topic;
                return (
                  <Pressable
                    key={entry.name}
                    onPress={() => {
                      setTopic(entry.name);
                      setSentTo(null);
                    }}
                    style={[styles.segment, selected && styles.segmentOn]}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        selected && { color: "#000" },
                      ]}
                    >
                      {entry.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Direction B's whole point: who hears this, before the button. */}
            <View style={styles.audience}>
              <View style={styles.audienceHead}>
                <Text style={styles.topicName}>{topic}</Text>
                <Caption>
                  {audience.isPending
                    ? "Counting"
                    : `${audience.data?.subscribed ?? 0} handsets`}
                </Caption>
              </View>
              <Caption style={{ marginTop: space.xs }}>
                {audience.isPending ? " " : describe(listening)}
              </Caption>
            </View>

            <View>
              <Eyebrow>Title</Eyebrow>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={topic}
                placeholderTextColor={colors.textFaint}
                maxLength={250}
                style={styles.input}
              />
            </View>

            <View>
              <Eyebrow>Message</Eyebrow>
              <TextInput
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={4096}
                style={[styles.input, styles.multiline]}
              />
            </View>

            <View style={styles.row}>
              {PRIORITIES.map((entry) => {
                const selected = entry.value === priority;
                return (
                  <Pressable
                    key={entry.value}
                    onPress={() => setPriority(entry.value)}
                    style={[styles.segment, selected && styles.segmentOn]}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        selected && { color: "#000" },
                      ]}
                    >
                      {entry.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Button
              disabled={!canSend}
              loading={send.isPending}
              onPress={() =>
                send.mutate({
                  topic,
                  title: title.trim() || undefined,
                  message: message.trim(),
                  priority,
                  tags: [],
                })
              }
            >
              {`Send to ${audience.data?.subscribed ?? 0} devices`}
            </Button>

            {send.isError ? (
              <Body soft style={{ color: colors.deny }}>
                {send.error.message}
              </Body>
            ) : null}

            {sentTo !== null ? (
              <Body soft>
                {sentTo === 0
                  ? "Sent, but no device was subscribed."
                  : `Sent to ${sentTo} devices.`}
              </Body>
            ) : null}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * The handsets, as a line of names.
 *
 * By person rather than by device, with a count where somebody carries two —
 * "Ana x2" is what makes it obvious that the two door phones are both hers.
 */
function describe(
  devices: readonly { user: { name: string } | null }[],
): string {
  if (devices.length === 0) return "Nobody is subscribed to this topic.";

  const counts = new Map<string, number>();
  for (const device of devices) {
    const name = device.user?.name ?? "Signed out";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  return [...counts]
    .map(([name, count]) => (count > 1 ? `${name} x${count}` : name))
    .join(", ");
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  segment: {
    flex: 1,
    alignItems: "center",
    paddingVertical: space.md,
    borderWidth: stroke.hair,
    borderColor: colors.borderStrong,
    marginLeft: -stroke.hair,
  },
  segmentOn: { backgroundColor: colors.text, borderColor: colors.text },
  segmentText: { ...type.label, color: colors.textSoft },
  audience: {
    borderWidth: stroke.hair,
    borderColor: colors.borderStrong,
    padding: space.md,
  },
  audienceHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  topicName: { ...type.heading, color: colors.text },
  input: {
    borderWidth: stroke.hair,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontSize: 15,
  },
  multiline: { minHeight: 110, textAlignVertical: "top" },
});
