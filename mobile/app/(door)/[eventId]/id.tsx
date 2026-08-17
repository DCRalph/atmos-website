import { useCallback, useState } from "react";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { api } from "@/lib/api";
import { labelArg, useDeviceLabel } from "@/lib/device-label";
import { colors, space, stroke } from "@/lib/theme";
import { Button, Caption } from "@/components/ui";
import { DoorHeader } from "@/components/door/door-header";
import { IdResult, type IdOutcome } from "@/components/door/id-result";
import { ID_DOCUMENTS } from "~/lib/ticketing/id-documents";

/**
 * Checking somebody's ID.
 *
 * Reached two ways: as a tab of its own, for the person who has not got to the
 * ticket yet, and straight off a scan result, which is the path that carries a
 * `ticketId` and so is the only one that can compare the name on the card with
 * the name on the ticket.
 *
 * Staff read the card and type what is on it. Everything after that — the age
 * arithmetic in the venue's timezone, the ban list, the name comparison,
 * whether the document is accepted evidence of age in New Zealand at all — is
 * the server's job and is the same however these fields arrived.
 *
 * **There is no camera here on purpose.** Reading a licence off a photograph is
 * a specialist job and the home-grown attempt was not good enough to put in
 * front of a queue. That work belongs to an ID SDK; when one is chosen it fills
 * in these same fields and submits them. See `~/lib/ticketing/id-reading` for
 * the seam and `docs/ticketing/ID-CHECKS.md` for the options.
 */
export default function IdScreen() {
  const { eventId, ticketId, attendeeName } = useLocalSearchParams<{
    eventId: string;
    ticketId?: string;
    attendeeName?: string;
  }>();
  const router = useRouter();

  const [outcome, setOutcome] = useState<IdOutcome | null>(null);
  const [documentType, setDocumentType] =
    useState<(typeof ID_DOCUMENTS)[number]["value"]>("NZ_DRIVER_LICENCE");
  const [fullName, setFullName] = useState("");
  const [birth, setBirth] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");

  const { deviceLabel } = useDeviceLabel();
  const summary = api.door.summary.useQuery(
    { eventId },
    { enabled: !!eventId },
  );

  const check = api.door.checkId.useMutation({
    onSuccess: async (result) => {
      setOutcome(result);
      await Haptics.notificationAsync(
        result.ok
          ? Haptics.NotificationFeedbackType.Success
          : result.result === "BANNED" || result.result === "UNDERAGE"
            ? Haptics.NotificationFeedbackType.Error
            : Haptics.NotificationFeedbackType.Warning,
      );
    },
    onError: async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const dateOfBirth = toIsoDate(birth);
  const ready = fullName.trim().length > 1 && dateOfBirth !== null;

  const reset = useCallback(() => {
    setOutcome(null);
    setFullName("");
    setBirth("");
    setDocumentNumber("");
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <DoorHeader
        eventId={eventId}
        summary={summary.data}
        active="id"
        onBack={() => router.replace("/(door)")}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: space.lg, gap: space.md }}
        keyboardShouldPersistTaps="handled"
      >
        <Caption>Which document</Caption>
        <View style={styles.typeGrid}>
          {ID_DOCUMENTS.map((option) => {
            const active = documentType === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setDocumentType(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={[styles.type, active && styles.typeActive]}
              >
                <Text style={[styles.typeLabel, active && { color: "#000" }]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ gap: space.xs }}>
          <Caption>Name, as printed</Caption>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            autoCorrect={false}
            placeholder="Jane Anne Smith"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
          />
        </View>

        <View style={{ gap: space.xs }}>
          <Caption>Date of birth — day/month/year</Caption>
          <TextInput
            value={birth}
            onChangeText={setBirth}
            keyboardType="number-pad"
            placeholder="15/01/1990"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
          />
        </View>

        <View style={{ gap: space.xs }}>
          <Caption>
            Document number — optional, but it&apos;s how we know them again
          </Caption>
          <TextInput
            value={documentNumber}
            onChangeText={setDocumentNumber}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="AB123456"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
          />
        </View>

        <Button
          onPress={() => {
            if (!dateOfBirth) return;
            check.mutate({
              eventId,
              ticketId: ticketId ?? undefined,
              deviceLabel: labelArg(deviceLabel),
              reading: {
                documentType,
                fullName: fullName.trim(),
                dateOfBirth,
                documentNumber: documentNumber.trim() || undefined,
              },
            });
          }}
          disabled={!ready || check.isPending}
          loading={check.isPending}
        >
          {ready ? "Check this person" : "Name and birthday first"}
        </Button>

        {/* IPP3: the person handing over the card is entitled to know what is
            being taken and why, before it is taken. Staff can turn the screen
            round; there is a sign for the door in the docs. */}
        <Text style={styles.privacy}>
          We record the name, date of birth and document number from the ID to
          check age and entry bans. It&apos;s deleted after 90 days unless
          there&apos;s a ban.
        </Text>
      </ScrollView>

      {outcome ? (
        <IdResult
          eventId={eventId}
          outcome={outcome}
          ticketId={ticketId}
          attendeeName={attendeeName}
          isManager={summary.data?.isManager ?? false}
          onDismiss={() => {
            reset();
            // Straight back to the ticket queue when that is where this came
            // from; an ID check off a scan is one step in a longer job.
            if (ticketId) {
              router.replace({
                pathname: "/(door)/[eventId]/scan",
                params: { eventId },
              });
            }
          }}
        />
      ) : null}
    </View>
  );
}

/**
 * `15/01/1990` → `1990-01-15`.
 *
 * Day-first, with no cleverness about the American order: somebody typing into
 * a New Zealand door app, under a label that says day/month, means day/month.
 */
function toIsoDate(value: string): string | null {
  const match = /^(\d{1,2})\s*[/.\-\s]\s*(\d{1,2})\s*[/.\-\s]\s*(\d{4})$/.exec(
    value.trim(),
  );
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  // Rejects the 31st of February and friends, which `Date` would otherwise
  // roll forward into March and hand back as a date nobody typed.
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  input: {
    height: 48,
    borderWidth: stroke.hard,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
    color: colors.text,
    fontSize: 16,
  },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  type: {
    flexGrow: 1,
    flexBasis: 140,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.sm,
    borderWidth: stroke.hard,
    borderColor: colors.border,
  },
  typeActive: { backgroundColor: colors.text, borderColor: colors.text },
  typeLabel: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  privacy: {
    color: colors.textFaint,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    marginTop: space.sm,
  },
});
