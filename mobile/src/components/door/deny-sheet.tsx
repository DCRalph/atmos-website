import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import {
  DENY_REASONS,
  type DenyReasonValue,
} from "~/lib/ticketing/deny-reasons";
import { colors, radius, space } from "@/lib/theme";
import { Body, Button, Caption, Title } from "@/components/ui";

/**
 * Why refuse.
 *
 * Fixed options rather than a free-text box: they get tapped one-handed in the
 * dark, and they are what the next scanner reads back off the ticket. Picking a
 * reason and confirming are separate taps, so this is its own confirmation —
 * there is no extra screen after it.
 *
 * The reason list is imported from the shared module the server validates
 * against, so the buttons here and the values the database accepts cannot
 * drift apart.
 */
export function DenySheet({
  attendee,
  pending,
  onCancel,
  onConfirm,
}: {
  attendee: string | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (reason: DenyReasonValue, note: string) => void;
}) {
  const [reason, setReason] = useState<DenyReasonValue | null>(null);
  const [note, setNote] = useState("");

  return (
    <Modal visible animationType="slide" transparent={false}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.body}>
          <Title style={{ color: "#fff" }}>Why refuse?</Title>
          <Caption style={{ color: "rgba(255,255,255,0.75)" }}>
            {attendee ? `${attendee} · ` : ""}the next scanner will see this
          </Caption>

          <View style={styles.grid}>
            {DENY_REASONS.map((option) => {
              const active = reason === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setReason(option.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[styles.option, active && styles.optionActive]}
                >
                  <Text
                    style={[styles.optionLabel, active && { color: "#7F1D1D" }]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ marginTop: space.lg, gap: space.xs }}>
            <Caption style={{ color: "rgba(255,255,255,0.75)" }}>
              Note (optional)
            </Caption>
            <TextInput
              value={note}
              onChangeText={setNote}
              maxLength={200}
              placeholder="Anything the next person should know"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.input}
            />
          </View>
        </ScrollView>

        <View style={styles.actions}>
          <Button
            variant="outline"
            disabled={!reason || pending}
            loading={pending}
            onPress={() => reason && onConfirm(reason, note.trim())}
          >
            {reason ? "Refuse entry" : "Pick a reason first"}
          </Button>
          {/* Bottom button, always the harmless one. */}
          <Pressable onPress={onCancel} disabled={pending} style={styles.safe}>
            <Body style={{ color: "#000", fontWeight: "800" }}>Back</Body>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#7F1D1D" },
  body: { padding: space.xl, paddingTop: space.xxl * 2, gap: space.xs },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
    marginTop: space.lg,
  },
  option: {
    width: "48%",
    minHeight: 68,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.sm,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(0,0,0,0.15)",
    borderRadius: radius.sm,
  },
  optionActive: { backgroundColor: "#fff", borderColor: "#fff" },
  optionLabel: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  input: {
    height: 52,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    color: "#fff",
    fontSize: 16,
  },
  actions: { padding: space.lg, paddingBottom: space.xxl, gap: space.md },
  safe: {
    height: 60,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
  },
});
