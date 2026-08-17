import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  DENY_REASONS,
  type DenyReasonValue,
} from "~/lib/ticketing/deny-reasons";
import { colors, radius, space } from "@/lib/theme";
import { Body, Button, Caption, Title } from "@/components/ui";

/**
 * Barring somebody from every Atmos event.
 *
 * A step beyond refusing entry, and shaped to feel like one. Refusing is the
 * job of whoever is holding the scanner and takes two taps; this is managers
 * only, asks for a reason *and* how long, and says out loud what it will do —
 * because the person it is done to will meet it again at a different door in
 * three months, with no memory of tonight to explain it.
 *
 * The duration options exist so that "banned" does not have to mean "forever".
 * A permanent ban should be a decision somebody makes on purpose, not the only
 * button available at 1am.
 */

const DURATIONS = [
  { label: "1 month", days: 30 },
  { label: "3 months", days: 90 },
  { label: "12 months", days: 365 },
  { label: "Permanent", days: null },
] as const;

export function BanSheet({
  name,
  pending,
  onCancel,
  onConfirm,
}: {
  name: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (
    reason: DenyReasonValue,
    note: string,
    expiresInDays: number | null,
  ) => void;
}) {
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState<DenyReasonValue | null>(null);
  const [note, setNote] = useState("");
  // Nothing is preselected: a ban's length is the part most worth a moment's
  // thought, and a default is a thing people accept without reading.
  const [duration, setDuration] = useState<number | null | undefined>(
    undefined,
  );

  const ready = reason !== null && duration !== undefined;

  return (
    <Modal visible animationType="slide" transparent={false}>
      <View
        style={[
          styles.screen,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        <ScrollView contentContainerStyle={styles.body}>
          <Title style={{ color: "#fff" }}>Ban {name}?</Title>
          <Caption style={{ color: "rgba(255,255,255,0.75)" }}>
            Every Atmos door will see this, at every future event, until a
            manager lifts it.
          </Caption>

          <Caption style={styles.legend}>Why</Caption>
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
                    style={[styles.optionLabel, active && { color: "#450A0A" }]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Caption style={styles.legend}>How long</Caption>
          <View style={styles.grid}>
            {DURATIONS.map((option) => {
              const active = duration === option.days && duration !== undefined;
              return (
                <Pressable
                  key={option.label}
                  onPress={() => setDuration(option.days)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[styles.option, active && styles.optionActive]}
                >
                  <Text
                    style={[styles.optionLabel, active && { color: "#450A0A" }]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ marginTop: space.lg, gap: space.xs }}>
            <Caption style={{ color: "rgba(255,255,255,0.75)" }}>
              What happened — the next door will read this
            </Caption>
            <TextInput
              value={note}
              onChangeText={setNote}
              maxLength={300}
              multiline
              placeholder="Threw a glass, refused to leave"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.input}
            />
          </View>
        </ScrollView>

        <View style={styles.actions}>
          <Button
            variant="outline"
            disabled={!ready || pending}
            loading={pending}
            onPress={() =>
              ready && onConfirm(reason, note.trim(), duration ?? null)
            }
          >
            {!reason
              ? "Pick a reason first"
              : duration === undefined
                ? "Pick how long"
                : duration === null
                  ? "Ban permanently"
                  : `Ban for ${DURATIONS.find((d) => d.days === duration)?.label}`}
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
  // Darker than the refusal sheet's red. This is the more serious of the two
  // and should not be mistaken for it at a glance.
  screen: { flex: 1, backgroundColor: "#450A0A" },
  body: { padding: space.xl, paddingTop: space.xxl, gap: space.xs },
  legend: {
    color: colors.text,
    marginTop: space.lg,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  option: {
    width: "48%",
    minHeight: 60,
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
    minHeight: 72,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingTop: space.md,
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
