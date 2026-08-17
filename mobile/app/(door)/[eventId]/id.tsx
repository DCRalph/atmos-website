import { useCallback, useRef, useState } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/lib/api";
import { labelArg, useDeviceLabel } from "@/lib/device-label";
import { isIdReadingAvailable, readIdDocument } from "@/lib/id-ocr";
import { colors, radius, space, stroke } from "@/lib/theme";
import { Body, Button, Caption, Loading, Notice } from "@/components/ui";
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
 * The card is photographed and read **on this phone** — Apple's Vision
 * framework, offline, free. The photo itself is never uploaded. What goes to
 * the server is the recognised text and, if a face was found, a crop of it;
 * the server does the parsing, the age arithmetic and the ban lookup, and
 * sends back a verdict.
 *
 * Manual entry sits one tap away rather than behind a failure. A camera that
 * cannot read a scratched licence is a normal Tuesday, and a door with a queue
 * cannot be left with no way forward.
 */
export default function IdScreen() {
  const { eventId, ticketId, attendeeName } = useLocalSearchParams<{
    eventId: string;
    ticketId?: string;
    attendeeName?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [outcome, setOutcome] = useState<IdOutcome | null>(null);
  const [portrait, setPortrait] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [manual, setManual] = useState(false);
  const [couldNotRead, setCouldNotRead] = useState(false);

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

  const capture = useCallback(async () => {
    if (reading || check.isPending) return;
    setCouldNotRead(false);
    setReading(true);

    try {
      const photo = await camera.current?.takePictureAsync({ quality: 0.9 });
      if (!photo?.uri) {
        setCouldNotRead(true);
        return;
      }

      const read = await readIdDocument(photo.uri);
      if (!read) {
        setCouldNotRead(true);
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Warning,
        );
        return;
      }

      setPortrait(read.portrait);
      check.mutate({
        eventId,
        ticketId: ticketId ?? undefined,
        deviceLabel: labelArg(deviceLabel),
        portrait: read.portrait ?? undefined,
        reading: { kind: "ocr", lines: read.lines },
      });
    } finally {
      setReading(false);
    }
  }, [check, deviceLabel, eventId, reading, ticketId]);

  const dismiss = useCallback(() => {
    setOutcome(null);
    setPortrait(null);
    setManual(false);
  }, []);

  if (!permission) return <Loading label="Checking camera" />;

  const canRead = isIdReadingAvailable();

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
        contentContainerStyle={{ padding: space.lg, gap: space.lg }}
        keyboardShouldPersistTaps="handled"
      >
        {!permission.granted ? (
          <Notice
            title="Camera access needed"
            detail="Reading an ID needs the camera. The photo stays on this phone — it's read here and never uploaded."
            action={
              <Button onPress={() => void requestPermission()}>
                Allow camera
              </Button>
            }
          />
        ) : !canRead ? (
          // A dev client older than the native module. Real, and recoverable:
          // typing the details in works exactly the same from here on.
          <Notice
            title="This build can't read cards"
            detail="Reading an ID needs a newer build of the app. You can still type the details in."
            action={<Button onPress={() => setManual(true)}>Type it in</Button>}
          />
        ) : manual ? null : (
          <>
            <View style={styles.viewfinder}>
              <CameraView
                ref={camera}
                style={StyleSheet.absoluteFill}
                facing="back"
              />
              {/* An ID-1 card is 85.6 × 54mm. Framing the guide to the real
                  proportions is what gets a whole card in shot rather than a
                  cropped one, and a cropped card is a missing birthday. */}
              <View pointerEvents="none" style={styles.guide} />
            </View>

            <Body soft style={{ textAlign: "center" }}>
              {reading
                ? "Reading…"
                : check.isPending
                  ? "Checking…"
                  : "Fill the frame with the front of the card"}
            </Body>

            <Button
              onPress={() => void capture()}
              loading={reading || check.isPending}
              disabled={reading || check.isPending}
            >
              Read this ID
            </Button>

            {couldNotRead ? (
              <Notice
                title="Couldn't read it"
                detail="Try again with the card flat and the light off the plastic — or type the details in."
                action={
                  <Button variant="outline" onPress={() => setManual(true)}>
                    Type it in
                  </Button>
                }
              />
            ) : (
              <Pressable onPress={() => setManual(true)} hitSlop={8}>
                <Caption style={{ textAlign: "center" }}>
                  Card won't read? Type it in
                </Caption>
              </Pressable>
            )}

            {/* IPP3: the person handing over the card is entitled to know what
                is being taken and why, before it is taken. Staff can turn the
                screen round; there is a sign for the door in the docs. */}
            <Text style={styles.privacy}>
              We record the name, date of birth and photo from the ID to check
              age and entry bans. It's deleted after 90 days unless there's a
              ban.
            </Text>
          </>
        )}

        {manual ? (
          <ManualEntry
            pending={check.isPending}
            onCancel={() => setManual(false)}
            onSubmit={(fields) => {
              setPortrait(null);
              check.mutate({
                eventId,
                ticketId: ticketId ?? undefined,
                deviceLabel: labelArg(deviceLabel),
                reading: { kind: "fields", ...fields },
              });
            }}
          />
        ) : null}
      </ScrollView>

      {outcome ? (
        <IdResult
          eventId={eventId}
          outcome={outcome}
          ticketId={ticketId}
          attendeeName={attendeeName}
          isManager={summary.data?.isManager ?? false}
          localPortrait={portrait}
          onRetake={() => {
            setOutcome(null);
            setPortrait(null);
          }}
          onDismiss={() => {
            dismiss();
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

      <View style={{ height: insets.bottom }} />
    </View>
  );
}

/**
 * Typing the card in by hand.
 *
 * The same endpoint as a camera read — a correction and a manual entry are the
 * same thing to the server — so everything downstream, the ban lookup, the age
 * arithmetic, the record, behaves identically. Only the document type has to
 * be picked, because that is the one field a person cannot infer from what
 * they typed and it decides whether the ID is even accepted evidence of age.
 */
function ManualEntry({
  pending,
  onCancel,
  onSubmit,
}: {
  pending: boolean;
  onCancel: () => void;
  onSubmit: (fields: {
    documentType: (typeof ID_DOCUMENTS)[number]["value"];
    documentNumber?: string;
    fullName: string;
    dateOfBirth: string;
  }) => void;
}) {
  const [documentType, setDocumentType] = useState<
    (typeof ID_DOCUMENTS)[number]["value"]
  >("NZ_DRIVER_LICENCE");
  const [fullName, setFullName] = useState("");
  const [birth, setBirth] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");

  const dateOfBirth = toIsoDate(birth);
  const ready = fullName.trim().length > 1 && dateOfBirth !== null;

  return (
    <View style={{ gap: space.md }}>
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
        <Caption>Document number (optional, but it's how we know them again)</Caption>
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
        onPress={() =>
          dateOfBirth &&
          onSubmit({
            documentType,
            fullName: fullName.trim(),
            dateOfBirth,
            documentNumber: documentNumber.trim() || undefined,
          })
        }
        disabled={!ready || pending}
        loading={pending}
      >
        {ready ? "Check this person" : "Name and birthday first"}
      </Button>

      <Pressable onPress={onCancel} hitSlop={8}>
        <Caption style={{ textAlign: "center" }}>Back to the camera</Caption>
      </Pressable>
    </View>
  );
}

/**
 * `15/01/1990` → `1990-01-15`.
 *
 * Day-first, with no cleverness about the American order: somebody typing into
 * a New Zealand door app under a label that says day/month means day/month.
 * The camera path is where ambiguity has to be handled, and it is handled
 * there.
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

  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  viewfinder: {
    // Wider than the ticket scanner's square: a card held up fills a landscape
    // frame, and a square one wastes half the sensor on the queue behind them.
    aspectRatio: 4 / 3,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  guide: {
    position: "absolute",
    top: "12%",
    left: "6%",
    right: "6%",
    // 85.6 × 54mm, as a percentage of the frame above.
    bottom: "12%",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
  },
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
  },
});
