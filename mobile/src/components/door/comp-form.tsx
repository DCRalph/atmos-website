import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { api } from "@/lib/api";
import {
  ACCESS_LEVELS,
  type AccessLevelValue,
} from "~/lib/ticketing/access-levels";
import { colors, radius, space } from "@/lib/theme";
import { Body, Button, Caption, Notice } from "@/components/ui";

/**
 * Giving somebody a ticket at the door.
 *
 * Not a sale for nothing: a comp is minted rather than drawn from a tier, so it
 * takes an access level directly and can put an artist on AAA at an event with
 * no AAA tier to sell. The name is the point — it goes on the ticket and the
 * door reads it back on every scan.
 *
 * Managers only, as on the web.
 */
export function CompForm({
  eventId,
  deviceLabel,
  onIssued,
}: {
  eventId: string;
  deviceLabel?: string;
  onIssued: (ticketNumber: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [level, setLevel] = useState<AccessLevelValue>("GUEST");
  const [overage, setOverage] = useState<string | null>(null);

  const comp = api.door.compAtDoor.useMutation({
    onSuccess: (result) => {
      setName("");
      setEmail("");
      setOverage(null);
      onIssued(result.hostTicketNumber);
    },
    onError: (error) => {
      // Over the cap or the allowance. A warning, never a refusal.
      if (error.data?.code === "PRECONDITION_FAILED") {
        setOverage(error.message);
        return;
      }
    },
  });

  const submit = (acknowledge: boolean) =>
    comp.mutate({
      eventId,
      recipientName: name.trim(),
      recipientEmail: email.trim() || undefined,
      accessLevel: level,
      deviceLabel,
      admitNow: true,
      acknowledge,
    });

  if (overage) {
    return (
      <View style={{ gap: space.md }}>
        <Notice title="Over the line" detail={overage} />
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Button
            variant="outline"
            style={{ flex: 1 }}
            onPress={() => setOverage(null)}
          >
            Cancel
          </Button>
          <Button
            style={{ flex: 1 }}
            loading={comp.isPending}
            onPress={() => submit(true)}
          >
            Comp anyway
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: space.lg }}>
      <View style={{ gap: space.xs }}>
        <Caption>Who&apos;s it for</Caption>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Name on the door"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="words"
          style={styles.input}
        />
        <Caption>
          Goes on the ticket for good — it&apos;s what you check their ID
          against.
        </Caption>
      </View>

      <View style={{ gap: space.sm }}>
        <Caption>What does it get them past?</Caption>
        <View style={styles.levels}>
          {ACCESS_LEVELS.map((option) => {
            const active = level === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setLevel(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={[styles.level, active && styles.levelActive]}
              >
                <Text
                  style={[styles.levelLabel, active && { color: "#000" }]}
                >
                  {option.short}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: space.xs }}>
        <Caption>Email it to them (optional)</Caption>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="them@example.com"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />
      </View>

      <Body soft style={{ color: colors.warn, fontSize: 13 }}>
        Comped — no money taken, and it&apos;s logged against your name.
      </Body>

      {comp.isError && !overage ? (
        <Caption style={{ color: colors.deny }}>{comp.error.message}</Caption>
      ) : null}

      <Button
        disabled={name.trim().length === 0}
        loading={comp.isPending}
        onPress={() => submit(false)}
      >
        Comp a ticket
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
    color: colors.text,
    fontSize: 16,
  },
  levels: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  level: {
    minWidth: 76,
    flexGrow: 1,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.sm,
  },
  levelActive: { backgroundColor: colors.text, borderColor: colors.text },
  levelLabel: { color: colors.textSoft, fontSize: 13, fontWeight: "800" },
});
