import { useState } from "react";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { api } from "@/lib/api";
import { labelArg, useDeviceLabel } from "@/lib/device-label";
import { colors, radius, space } from "@/lib/theme";
import { Body, Button, Caption } from "@/components/ui";
import { DoorHeader } from "@/components/door/door-header";
import { ScanResult, type ScanOutcome } from "@/components/door/scan-result";

/**
 * For a cracked screen or a dead phone.
 *
 * Resolves the typed number to the real token and runs the identical scan
 * path, so nothing slips past the duplicate check just because it was typed
 * rather than scanned.
 */
export default function ManualScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const [value, setValue] = useState("");
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);

  const { deviceLabel } = useDeviceLabel();

  const summary = api.door.summary.useQuery(
    { eventId },
    { enabled: !!eventId, refetchInterval: 15_000 },
  );
  const utils = api.useUtils();

  const admit = api.door.admitByTicketNumber.useMutation({
    onSuccess: async (result) => {
      setOutcome(result as ScanOutcome);
      setValue("");
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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <DoorHeader eventId={eventId} summary={summary.data} active="manual" />

      <View style={{ padding: space.lg, gap: space.lg }}>
        <View style={{ gap: space.xs }}>
          <Caption>Ticket number</Caption>
          <TextInput
            value={value}
            onChangeText={(text) => setValue(text.toUpperCase())}
            placeholder="ATM-4F7K2X-03"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="characters"
            autoCorrect={false}
            style={styles.input}
          />
          <Caption>It is printed under the QR on their ticket.</Caption>
        </View>

        <Button
          onPress={() =>
            admit.mutate({
              eventId,
              ticketNumber: value.trim(),
              deviceLabel: labelArg(deviceLabel),
            })
          }
          disabled={value.trim().length < 3}
          loading={admit.isPending}
        >
          Look it up
        </Button>

        {admit.isError ? (
          <View style={styles.error}>
            <Body style={{ color: colors.deny }}>{admit.error.message}</Body>
          </View>
        ) : null}
      </View>

      {outcome ? (
        <ScanResult
          eventId={eventId}
          outcome={outcome}
          isManager={summary.data?.isManager ?? false}
          onDismiss={() => setOutcome(null)}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  input: {
    height: 60,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
    color: colors.text,
    fontSize: 20,
    fontFamily: "Menlo",
    letterSpacing: 1,
  },
  error: {
    padding: space.md,
    borderRadius: radius.sm,
    backgroundColor: colors.denyDim,
  },
});
