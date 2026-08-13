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

import { api, type RouterOutputs } from "@/lib/api";
import { denyReasonLabel } from "~/lib/ticketing/deny-reasons";
import { scanResultLabel } from "~/lib/ticketing/scan-results";
import { scanToneColor } from "@/lib/scan-tone";
import { labelArg, useDeviceLabel } from "@/lib/device-label";
import { colors, radius, space } from "@/lib/theme";
import { formatTimeAgo } from "@/lib/dates";
import { Body, Button, Caption, Loading, Pill } from "@/components/ui";
import { DenySheet } from "@/components/door/deny-sheet";
import { AccessBadge } from "@/components/door/access-badge";

/**
 * One person, opened from the door list.
 *
 * The list answers "is this name on it"; this answers everything staff ask
 * next — who bought it, whether they are already inside, and whether somebody
 * has already turned them away.
 */
export function PersonSheet({
  eventId,
  ticketId,
  isManager,
  onClose,
  onAdmit,
}: {
  eventId: string;
  ticketId: string;
  isManager: boolean;
  onClose: () => void;
  onAdmit: (ticketNumber: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<
    | "detail"
    | "party"
    | "deny"
    | "history"
    | "note"
    | "confirm-revert"
    | "confirm-leave"
  >("detail");
  const detail = api.door.ticketDetail.useQuery({ eventId, ticketId });
  const utils = api.useUtils();
  // A refusal is the entry staff are most likely to be asked about later, so
  // it carries the same device tag as an admission.
  const { deviceLabel } = useDeviceLabel();

  const deny = api.door.deny.useMutation({
    onSuccess: () => {
      void utils.door.ticketDetail.invalidate();
      void utils.door.doorList.invalidate();
      void utils.door.summary.invalidate();
      void utils.door.orderTickets.invalidate();
      setStep("detail");
    },
  });

  const undoDenial = api.door.revertDenial.useMutation({
    onSuccess: () => {
      void utils.door.ticketDetail.invalidate();
      void utils.door.doorList.invalidate();
      void utils.door.activity.invalidate();
      void utils.door.orderTickets.invalidate();
    },
  });

  const addNote = api.door.addNote.useMutation({
    onSuccess: () => {
      void utils.door.ticketDetail.invalidate();
      void utils.door.activity.invalidate();
      setStep("detail");
    },
  });

  const revert = api.door.revertAdmission.useMutation({
    onSuccess: () => {
      void utils.door.ticketDetail.invalidate();
      void utils.door.doorList.invalidate();
      void utils.door.summary.invalidate();
      void utils.door.orderTickets.invalidate();
      void utils.door.recentScans.invalidate();
      setStep("detail");
    },
  });

  /**
   * Watching somebody leave.
   *
   * Not an undo, and the confirmation screen behind it exists to keep the two
   * apart: both drop the headcount by one, and on a phone they sit one above
   * the other in the same stack. The difference is the record — this leaves
   * the admission standing and says it is over, so their ticket scans clean on
   * the way back in even where re-entry is switched off.
   */
  const depart = api.door.markDeparted.useMutation({
    onSuccess: () => {
      void utils.door.ticketDetail.invalidate();
      void utils.door.doorList.invalidate();
      void utils.door.summary.invalidate();
      void utils.door.orderTickets.invalidate();
      void utils.door.recentScans.invalidate();
      setStep("detail");
    },
  });

  const person = detail.data;
  const isIn = person?.admittedAt != null;

  return (
    <Modal visible animationType="slide" transparent={false}>
      <View
        style={[
          styles.screen,
          // Full-screen modals sit under the notch and the home indicator
          // otherwise — the verdict ran into the Dynamic Island.
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        {detail.isPending || !person ? (
          <View style={{ flex: 1, justifyContent: "center" }}>
            <Loading label="Loading ticket" />
          </View>
        ) : step === "party" ? (
          <PartyView
            eventId={eventId}
            ticketId={person.id}
            onAdmit={onAdmit}
            onBack={() => setStep("detail")}
          />
        ) : step === "note" ? (
          <NoteComposer
            pending={addNote.isPending}
            onCancel={() => setStep("detail")}
            onSave={(note) =>
              addNote.mutate({
                eventId,
                ticketId,
                note,
                deviceLabel: labelArg(deviceLabel),
              })
            }
          />
        ) : step === "history" ? (
          <HistoryView
            timeline={person?.timeline ?? []}
            onBack={() => setStep("detail")}
          />
        ) : step === "deny" ? (
          <DenySheet
            attendee={person.attendeeName ?? person.buyerName ?? null}
            pending={deny.isPending}
            onCancel={() => setStep("detail")}
            onConfirm={(reason, note) =>
              deny.mutate({
                eventId,
                ticketId: person.id,
                reason,
                note: note || undefined,
                deviceLabel: labelArg(deviceLabel),
              })
            }
          />
        ) : step === "confirm-revert" ? (
          <ConfirmScreen
            tint={colors.warn}
            heading="Undo admission?"
            body={`${personName(person) ?? person.ticketNumber} goes back to not having arrived, and the headcount drops by one. Their ticket will scan clean again.`}
            footnote="Use this for a mis-scan, not to turn somebody away — refusing entry keeps a reason on the ticket."
            confirmLabel={revert.isPending ? "Undoing…" : "Yes, undo it"}
            pending={revert.isPending}
            onConfirm={() => revert.mutate({ eventId, ticketId: person.id })}
            onCancel={() => setStep("detail")}
          />
        ) : step === "confirm-leave" ? (
          <ConfirmScreen
            tint={colors.left}
            heading="Mark as left?"
            body={`${personName(person) ?? person.ticketNumber} comes off the headcount. Their ticket scans clean on the way back in${
              person.reentryAllowed ? "" : ", even though re-entry is off"
            }.`}
            footnote="Their admission stays on record — this says they've gone, not that it never happened."
            confirmLabel={depart.isPending ? "Marking…" : "Yes, they've left"}
            pending={depart.isPending}
            onConfirm={() => depart.mutate({ eventId, ticketId: person.id })}
            onCancel={() => setStep("detail")}
          />
        ) : (
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.name}>
              {person.attendeeName ?? person.buyerName ?? "No name given"}
            </Text>
            <Body soft>{person.tierName}</Body>
            <Text style={styles.mono}>
              {person.ticketNumber} · {person.positionInOrder}
            </Text>
            <View style={{ marginTop: space.xs }}>
              <AccessBadge level={person.accessLevel} />
            </View>

            {/* Sits against the "1 of 4" that prompts the question, rather than
                in the action stack, which is reserved for things that change a
                decision. */}
            {person.orderTicketCount > 1 ? (
              <Pressable onPress={() => setStep("party")} style={styles.partyBtn}>
                <Body style={{ fontWeight: "700" }}>
                  See the other {person.orderTicketCount - 1} on this order
                </Body>
              </Pressable>
            ) : null}

            {/* Every scan this ticket has taken. The question after "are they
                in" is "what happened before", and until now the door had no
                way to answer it. */}
            {person.timeline.length > 0 ? (
              <Pressable
                onPress={() => setStep("history")}
                style={styles.partyBtn}
              >
                <Body style={{ fontWeight: "700" }}>
                  Scan history ({person.timeline.length})
                </Body>
              </Pressable>
            ) : null}

            <View style={styles.rows}>
              <Row label="Order" value={person.orderNumber} />
              {person.buyerName ? (
                <Row label="Bought by" value={person.buyerName} />
              ) : null}
              {person.buyerEmail ? (
                <Row label="Email" value={person.buyerEmail} />
              ) : null}
            </View>

            <View style={{ marginTop: space.lg }}>
              {person.denial ? (
                <View style={[styles.state, { borderColor: colors.deny }]}>
                  <Body style={{ color: colors.deny, fontWeight: "700" }}>
                    Refused entry
                  </Body>
                  <Caption>
                    {person.denial.note ?? person.denial.reason ?? ""}
                  </Caption>
                </View>
              ) : isIn ? (
                <View style={[styles.state, { borderColor: colors.in }]}>
                  <Body style={{ color: colors.in, fontWeight: "700" }}>
                    In {formatTimeAgo(new Date(person.admittedAt!))}
                  </Body>
                  <Caption>
                    {person.admittedBy
                      ? `by ${person.admittedBy}`
                      : "by an unknown scanner"}
                    {person.admittedDevice ? ` on ${person.admittedDevice}` : ""}
                  </Caption>
                  {person.admissionCount > 1 ? (
                    <Caption>
                      {person.admissionCount} admissions on record
                    </Caption>
                  ) : null}
                </View>
              ) : person.departedAt ? (
                /* Distinct from both "in" and "not arrived": they were here,
                   and the ticket is expected to come back through the door. */
                <View style={[styles.state, { borderColor: colors.left }]}>
                  <Body style={{ color: colors.left, fontWeight: "700" }}>
                    Left {formatTimeAgo(new Date(person.departedAt))}
                  </Body>
                  <Caption>
                    {person.departedBy
                      ? `marked out by ${person.departedBy}`
                      : "marked out"}
                  </Caption>
                  <Caption>
                    Was in{" "}
                    {person.admissionCount === 1
                      ? "once"
                      : `${person.admissionCount} times`}
                    . Their ticket scans clean on the way back.
                  </Caption>
                </View>
              ) : (
                <View style={styles.state}>
                  <Body style={{ fontWeight: "700" }}>Not arrived</Body>
                  <Caption>No scan against this ticket yet.</Caption>
                </View>
              )}
            </View>

            {person.isR18 ? (
              <View style={{ marginTop: space.md }}>
                <Pill tone="deny">R18 — CHECK ID</Pill>
              </View>
            ) : null}
          </ScrollView>
        )}

        {step === "detail" && person ? (
          <View style={styles.actions}>
            {!isIn ? (
              <Button onPress={() => onAdmit(person.ticketNumber)}>
                {person.denial
                  ? "Admit anyway"
                  : person.departedAt
                    ? "Back in"
                    : "Admit"}
              </Button>
            ) : null}
            {/* An ordinary action, not an exception: watching people leave is
                the job, nothing is being overruled, and it is undone by
                scanning them back in. Above "Undo admission" because it is the
                one staff reach for far more often. */}
            {isIn ? (
              <Button onPress={() => setStep("confirm-leave")}>
                Mark as left
              </Button>
            ) : null}
            {isIn && isManager ? (
              <Button
                variant="outline"
                onPress={() => setStep("confirm-revert")}
              >
                Undo admission
              </Button>
            ) : null}
            {/* Open to every staffer, not just managers — the person holding
                the scanner is the one looking at the punter, and a refusal
                that has to wait for a manager is a refusal that never happens. */}
            {!person.denial ? (
              <Button variant="outline" onPress={() => setStep("deny")}>
                Deny entry
              </Button>
            ) : (
              /* Any staffer, not just a manager: a refusal is the one call
                 every staffer can make, so a mis-tap has to be fixable by the
                 person who made it. */
              <Button
                variant="outline"
                loading={undoDenial.isPending}
                onPress={() =>
                  undoDenial.mutate({
                    eventId,
                    ticketId: person.id,
                    deviceLabel: labelArg(deviceLabel),
                  })
                }
              >
                Take back refusal
              </Button>
            )}
            <Button variant="outline" onPress={() => setStep("note")}>
              Add a note
            </Button>
            <Button variant="outline" onPress={onClose}>
              Close
            </Button>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

/**
 * A note, without turning anybody away.
 *
 * Deliberately not a decision: nothing about the ticket changes, it just lands
 * in the timeline next to everything else so the next staffer sees it.
 */
function NoteComposer({
  pending,
  onCancel,
  onSave,
}: {
  pending: boolean;
  onCancel: () => void;
  onSave: (note: string) => void;
}) {
  const [text, setText] = useState("");
  return (
    <ScrollView
      contentContainerStyle={styles.body}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable onPress={onCancel} hitSlop={8}>
        <Caption>‹ Back</Caption>
      </Pressable>
      <Text style={styles.name}>Add a note</Text>
      <Caption>
        Seen by anyone who opens this ticket. Nothing about their entry changes.
      </Caption>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Argued at the door, ID looked off…"
        placeholderTextColor={colors.textFaint}
        multiline
        style={styles.noteInput}
      />
      <Button
        onPress={() => onSave(text.trim())}
        disabled={text.trim().length === 0}
        loading={pending}
      >
        Save note
      </Button>
    </ScrollView>
  );
}

/**
 * Everything that has happened to this ticket, newest first.
 *
 * Reads as a log rather than a summary on purpose: a refusal followed by an
 * override is a different story from a clean admission, and the door is where
 * that gets argued about.
 */
function HistoryView({
  timeline,
  onBack,
}: {
  timeline: NonNullable<RouterOutputs["door"]["ticketDetail"]>["timeline"];
  onBack: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Pressable onPress={onBack} hitSlop={8}>
        <Caption>‹ Back</Caption>
      </Pressable>
      <Text style={styles.name}>Scan history</Text>

      <View style={{ gap: space.sm }}>
        {timeline.map((entry) => {
          const tone = scanToneColor(entry.result);
          return (
            <View key={entry.id} style={styles.historyRow}>
              <View style={[styles.historyDot, { backgroundColor: tone }]} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Body style={{ fontWeight: "700", color: tone }}>
                  {scanResultLabel(entry.result)}
                </Body>
                {entry.reason ? (
                  <Caption>
                    {denyReasonLabel(entry.reason)}
                    {entry.note ? ` — ${entry.note}` : ""}
                  </Caption>
                ) : null}
                <Caption>
                  {formatTimeAgo(entry.at)}
                  {entry.by ? ` · ${entry.by}` : ""}
                  {entry.device ? ` · ${entry.device}` : ""}
                </Caption>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

/**
 * A decision that drops the headcount, behind one deliberate tap.
 *
 * Shared by "undo admission" and "mark as left" because the whole risk is that
 * those two are confused for each other: same effect on the count, opposite
 * meaning on the record. Each gets its own colour and its own sentence saying
 * what it will leave behind.
 */
function ConfirmScreen({
  tint,
  heading,
  body,
  footnote,
  confirmLabel,
  pending,
  onConfirm,
  onCancel,
}: {
  tint: string;
  heading: string;
  body: string;
  footnote: string;
  confirmLabel: string;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    // Its own modal, as `DenySheet` is, so the colour reaches the edges of the
    // screen. Nested inside the person sheet it would sit within that sheet's
    // safe-area padding and read as a panel with black bands, which is not the
    // "stop and look at this" a headcount change wants.
    <Modal visible animationType="slide" transparent={false}>
      <View
        style={[
          styles.confirm,
          {
            backgroundColor: tint,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <View style={styles.confirmBody}>
          <Text style={styles.confirmHeading}>{heading}</Text>
          <Text style={styles.confirmText}>{body}</Text>
          <Text style={styles.confirmFootnote}>{footnote}</Text>
        </View>
        <View style={styles.confirmActions}>
          <Button variant="outline" loading={pending} onPress={onConfirm}>
            {confirmLabel}
          </Button>
          {/* Last and harmless, as everywhere else on the door. */}
          <Button onPress={onCancel} disabled={pending}>
            Cancel
          </Button>
        </View>
      </View>
    </Modal>
  );
}

/** The name to put in a sentence, or null when the ticket has none. */
function personName(
  person: NonNullable<RouterOutputs["door"]["ticketDetail"]>,
): string | null {
  return person.attendeeName ?? person.buyerName ?? null;
}

/** The rest of the order — who else is on it, and are they in yet. */
function PartyView({
  eventId,
  ticketId,
  onAdmit,
  onBack,
}: {
  eventId: string;
  ticketId: string;
  onAdmit: (ticketNumber: string) => void;
  onBack: () => void;
}) {
  const party = api.door.orderTickets.useQuery({ eventId, ticketId });
  const rows = party.data ?? [];
  const inCount = rows.filter((row) => row.admittedAt !== null).length;

  return (
    <>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.name}>Everyone on this order</Text>
        {rows.length > 0 ? (
          <Body soft>
            {inCount} of {rows.length} already in
          </Body>
        ) : null}

        {party.isPending ? <Loading /> : null}

        <View style={{ marginTop: space.lg, gap: space.sm }}>
          {rows.map((row) => (
            <View key={row.id} style={styles.partyRow}>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Body numberOfLines={1} style={{ fontWeight: "600" }}>
                  {row.attendeeName ?? "No name given"}
                  {row.isCurrent ? "  ·  this ticket" : ""}
                </Body>
                <Caption numberOfLines={1}>
                  {row.tierName} · {row.ticketNumber}
                </Caption>
                <AccessBadge level={row.accessLevel} size="small" onlyElevated />
                {/* A refusal outranks everything — it is the reason they are
                    standing there arguing. */}
                {row.deniedAt ? (
                  <Caption style={{ color: colors.deny, fontWeight: "700" }}>
                    Refused {formatTimeAgo(new Date(row.deniedAt))}
                  </Caption>
                ) : row.admittedAt ? (
                  <Caption style={{ color: colors.in }}>
                    In {formatTimeAgo(new Date(row.admittedAt))}
                  </Caption>
                ) : !row.isValid ? (
                  <Caption style={{ color: colors.warn, fontWeight: "700" }}>
                    {row.status === "REFUNDED" ? "Refunded" : "Void"} — not valid
                  </Caption>
                ) : (
                  <Caption>Not arrived</Caption>
                )}
              </View>

              {row.admittedAt ? (
                <Pill tone="in">IN</Pill>
              ) : row.isValid ? (
                <Pressable
                  onPress={() => onAdmit(row.ticketNumber)}
                  style={styles.admit}
                >
                  <Caption style={{ color: colors.text, fontWeight: "700" }}>
                    Admit
                  </Caption>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <Button variant="outline" onPress={onBack}>
          Back
        </Button>
      </View>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Caption>{label}</Caption>
      <Body numberOfLines={1} style={{ flexShrink: 1, textAlign: "right" }}>
        {value}
      </Body>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#111" },
  body: { padding: space.xl, paddingTop: space.xxl * 2, gap: space.xs },
  name: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  mono: { color: colors.textFaint, fontFamily: "Menlo", fontSize: 13 },
  noteInput: {
    minHeight: 110,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: space.md,
    color: colors.text,
    fontSize: 15,
    textAlignVertical: "top",
  },
  historyRow: {
    flexDirection: "row",
    gap: space.md,
    padding: space.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyDot: { width: 8, height: 8, marginTop: 6 },
  partyBtn: {
    marginTop: space.lg,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingVertical: space.md,
    alignItems: "center",
  },
  rows: {
    marginTop: space.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: space.md,
    gap: space.sm,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: space.lg,
  },
  state: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: space.lg,
  },
  partyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  admit: {
    borderWidth: 2,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  actions: {
    padding: space.lg,
    paddingBottom: space.xxl,
    gap: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  confirm: { flex: 1 },
  confirmActions: {
    padding: space.lg,
    paddingBottom: space.xxl,
    gap: space.sm,
  },
  confirmBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xl,
    gap: space.md,
  },
  confirmHeading: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.8,
    textAlign: "center",
  },
  confirmText: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 16,
    textAlign: "center",
    maxWidth: 380,
  },
  confirmFootnote: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    textAlign: "center",
    maxWidth: 380,
    marginTop: space.md,
  },
});
