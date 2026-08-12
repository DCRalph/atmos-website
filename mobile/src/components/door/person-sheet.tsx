import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { api } from "@/lib/api";
import { colors, radius, space } from "@/lib/theme";
import { formatTimeAgo } from "@/lib/dates";
import { Body, Button, Caption, Loading, Pill } from "@/components/ui";
import { DenySheet } from "@/components/door/deny-sheet";

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
  const [step, setStep] = useState<"detail" | "party" | "deny">("detail");
  const detail = api.door.ticketDetail.useQuery({ eventId, ticketId });
  const utils = api.useUtils();

  const deny = api.door.deny.useMutation({
    onSuccess: () => {
      void utils.door.ticketDetail.invalidate();
      void utils.door.doorList.invalidate();
      void utils.door.summary.invalidate();
      void utils.door.orderTickets.invalidate();
      setStep("detail");
    },
  });

  const revert = api.door.revertAdmission.useMutation({
    onSuccess: () => {
      void utils.door.ticketDetail.invalidate();
      void utils.door.doorList.invalidate();
      void utils.door.summary.invalidate();
      void utils.door.orderTickets.invalidate();
    },
  });

  const person = detail.data;
  const isIn = person?.admittedAt != null;

  return (
    <Modal visible animationType="slide" transparent={false}>
      <View style={styles.screen}>
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
              })
            }
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
                {person.denial ? "Admit anyway" : "Admit"}
              </Button>
            ) : null}
            {isIn && isManager ? (
              <Button
                variant="outline"
                loading={revert.isPending}
                onPress={() => revert.mutate({ eventId, ticketId: person.id })}
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
            ) : null}
            <Button variant="outline" onPress={onClose}>
              Close
            </Button>
          </View>
        ) : null}
      </View>
    </Modal>
  );
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
});
