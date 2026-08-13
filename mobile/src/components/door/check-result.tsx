import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { RouterOutputs } from "@/lib/api";
import { denyReasonLabel } from "~/lib/ticketing/deny-reasons";
import { scanResultLabel } from "~/lib/ticketing/scan-results";
import { paymentMethodLabel } from "~/lib/ticketing/payment-methods";
import { scanToneColor } from "@/lib/scan-tone";
import { formatTimeAgo } from "@/lib/dates";
import { colors, radius, space } from "@/lib/theme";
import { Body, Button, Caption, Pill } from "@/components/ui";
import { AccessBadge } from "@/components/door/access-badge";

export type TicketCheck = RouterOutputs["door"]["checkTicket"];

/**
 * The answer to "is this ticket real", read out in full.
 *
 * Deliberately *not* painted head to toe in the result colour the way a scan
 * is. A green screen across a queue means "that one's in", and this screen
 * admitted nobody — somebody glancing over a shoulder must not read it as an
 * admission. So the colour is confined to one block, and the line above it
 * says what this screen is, every time.
 *
 * Where a scan answers one question in two words, a check is opened by someone
 * who has time and an argument in front of them, so this leads with the verdict
 * and then keeps going: who the ticket belongs to, whether anyone has ever
 * knocked them back, and every scan on record with who took it and where.
 */

const TONE: Record<TicketCheck["verdict"], { border: string; fill: string }> = {
  OK: { border: colors.in, fill: colors.inDim },
  ALREADY_IN: { border: colors.warn, fill: colors.warnDim },
  REFUSED: { border: colors.deny, fill: colors.denyDim },
  NOT_VALID: { border: colors.deny, fill: colors.denyDim },
};

export function CheckResult({
  check,
  onDismiss,
}: {
  check: TicketCheck;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  const tone = TONE[check.verdict];
  const ticket = check.ticket;

  return (
    <Modal visible animationType="slide" transparent={false}>
      <View
        style={[
          styles.screen,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        <ScrollView contentContainerStyle={styles.body}>
          {/* Restated on every check, because the whole risk of this screen is
              being mistaken for a scan result. */}
          <Text style={styles.eyebrow}>Ticket check · nothing recorded</Text>

          <View
            style={[
              styles.verdict,
              { borderColor: tone.border, backgroundColor: tone.fill },
            ]}
          >
            <Text style={[styles.headline, { color: tone.border }]}>
              {check.headline}
            </Text>
            <Body>{check.detail}</Body>
          </View>

          {ticket ? (
            <>
              <View style={{ marginTop: space.xl, gap: space.xs }}>
                <Text style={styles.name}>
                  {ticket.attendeeName ?? ticket.buyerName ?? "No name given"}
                </Text>
                <View style={{ alignSelf: "flex-start" }}>
                  <AccessBadge level={ticket.accessLevel} />
                </View>
                {ticket.invitedByName ? (
                  <Body style={{ fontWeight: "700" }}>
                    Invited by {ticket.invitedByName}
                  </Body>
                ) : null}
                <Body soft>{ticket.tierName}</Body>
                <Text style={styles.mono}>
                  {ticket.ticketNumber} · {ticket.positionInOrder}
                  {ticket.isComp ? " · comp" : ""}
                </Text>
              </View>

              {ticket.nameLocked && ticket.attendeeName ? (
                <View style={[styles.state, { marginTop: space.md }]}>
                  <Body style={{ fontWeight: "700" }}>
                    Photo ID — this ticket is in the name of{" "}
                    {ticket.attendeeName}
                  </Body>
                </View>
              ) : null}

              <View style={styles.rows}>
                <Row label="Order" value={ticket.orderNumber} />
                {ticket.buyerName ? (
                  <Row label="Bought by" value={ticket.buyerName} />
                ) : null}
                {ticket.buyerEmail ? (
                  <Row label="Email" value={ticket.buyerEmail} />
                ) : null}
                <Row
                  label="Paid by"
                  value={
                    ticket.isComp ? "Comp" : paymentMethodLabel(ticket.paymentMethod)
                  }
                />
                <Row
                  label="Re-entry"
                  value={check.reentryAllowed ? "Allowed" : "No"}
                />
              </View>
            </>
          ) : null}

          {/* The standing refusal first, because it is the one that decides
              what happens next; the count below answers the different question
              of whether this person has ever been knocked back at all. */}
          {check.denial ? (
            <View
              style={[
                styles.state,
                { borderColor: colors.deny, marginTop: space.xl },
              ]}
            >
              <Body style={{ color: colors.deny, fontWeight: "700" }}>
                Refused entry
              </Body>
              <Caption>
                {denyReasonLabel(check.denial.reason)}
                {check.denial.note ? ` — ${check.denial.note}` : ""}
              </Caption>
              <Caption>
                {formatTimeAgo(new Date(check.denial.at))}
                {check.denial.scannedByName
                  ? ` · ${check.denial.scannedByName}`
                  : ""}
                {check.denial.deviceLabel
                  ? ` · ${check.denial.deviceLabel}`
                  : ""}
              </Caption>
            </View>
          ) : null}

          {check.refusalCount > 0 && !check.denial ? (
            <View
              style={[
                styles.state,
                { borderColor: colors.warn, marginTop: space.xl },
              ]}
            >
              <Caption style={{ color: colors.warn }}>
                Refused {check.refusalCount === 1 ? "once" : `${check.refusalCount} times`}{" "}
                earlier. That no longer stands — it was taken back, or they were
                admitted afterwards. The history below has who did what.
              </Caption>
            </View>
          ) : null}

          {check.found ? (
            <View style={{ marginTop: space.xl }}>
              {check.admittedAt ? (
                <View style={[styles.state, { borderColor: colors.in }]}>
                  <Body style={{ color: colors.in, fontWeight: "700" }}>
                    In {formatTimeAgo(new Date(check.admittedAt))}
                  </Body>
                  <Caption>
                    {check.admittedBy
                      ? `by ${check.admittedBy}`
                      : "by an unknown scanner"}
                    {check.admittedDevice ? ` on ${check.admittedDevice}` : ""}
                  </Caption>
                  {check.admissionCount > 1 ? (
                    <Caption>{check.admissionCount} admissions on record</Caption>
                  ) : null}
                </View>
              ) : check.departedAt ? (
                <View style={[styles.state, { borderColor: colors.left }]}>
                  <Body style={{ color: colors.left, fontWeight: "700" }}>
                    Left {formatTimeAgo(new Date(check.departedAt))}
                  </Body>
                  <Caption>
                    {check.departedBy
                      ? `marked out by ${check.departedBy}`
                      : "marked out"}
                    {check.admissionCount > 1
                      ? ` · ${check.admissionCount} admissions on record`
                      : ""}
                  </Caption>
                </View>
              ) : (
                <View style={styles.state}>
                  <Body style={{ fontWeight: "700" }}>Not arrived</Body>
                  <Caption>Nobody has come in on this ticket.</Caption>
                </View>
              )}
            </View>
          ) : null}

          {check.isR18 ? (
            <View style={{ marginTop: space.md, alignSelf: "flex-start" }}>
              <Pill tone="deny">R18 — CHECK ID</Pill>
            </View>
          ) : null}

          {check.history.length > 0 ? (
            <View style={{ marginTop: space.xl, gap: space.sm }}>
              <Text style={styles.sectionTitle}>
                Scan history
                {check.scanCount > check.history.length
                  ? ` · showing ${check.history.length} of ${check.scanCount}`
                  : ""}
              </Text>
              {check.history.map((entry) => {
                const entryTone = scanToneColor(entry.result);
                return (
                  <View key={entry.id} style={styles.historyRow}>
                    <View
                      style={[styles.historyDot, { backgroundColor: entryTone }]}
                    />
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Body style={{ fontWeight: "700", color: entryTone }}>
                        {scanResultLabel(entry.result)}
                        {entry.wasOverride ? " · override" : ""}
                      </Body>
                      {entry.denyReason ? (
                        <Caption>
                          {denyReasonLabel(entry.denyReason)}
                          {entry.denyNote ? ` — ${entry.denyNote}` : ""}
                        </Caption>
                      ) : null}
                      <Caption>
                        {formatTimeAgo(new Date(entry.at))}
                        {entry.scannedByName ? ` · ${entry.scannedByName}` : ""}
                        {entry.deviceLabel ? ` · ${entry.deviceLabel}` : ""}
                      </Caption>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

          {check.verdict === "OK" ? (
            <Caption style={{ marginTop: space.xl }}>
              Nothing here let them in. Use Scan when they&apos;re ready to come
              through.
            </Caption>
          ) : null}
        </ScrollView>

        <View style={styles.actions}>
          <Button onPress={onDismiss}>Check another</Button>
        </View>
      </View>
    </Modal>
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
  body: { padding: space.xl, paddingBottom: space.xxl },
  eyebrow: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  verdict: {
    marginTop: space.md,
    borderWidth: 2,
    borderRadius: radius.sm,
    padding: space.lg,
    gap: space.xs,
  },
  headline: { fontSize: 28, fontWeight: "900", letterSpacing: -0.8 },
  name: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  mono: { color: colors.textFaint, fontFamily: "Menlo", fontSize: 13 },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
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
    gap: 2,
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
  actions: {
    padding: space.lg,
    paddingBottom: space.xxl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
