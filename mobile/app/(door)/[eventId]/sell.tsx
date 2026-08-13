import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Minus, Plus } from "lucide-react-native";

import { api } from "@/lib/api";
import { useDeviceLabel } from "@/lib/device-label";
import { useTapToPay } from "@/lib/tap-to-pay";
import { colors, radius, space, stroke } from "@/lib/theme";
import { Body, Button, Caption, Loading, Notice } from "@/components/ui";
import { DoorHeader } from "@/components/door/door-header";
import { TapToPaySheet } from "@/components/door/tap-to-pay";
import { TapToPayMark } from "@/components/door/tap-to-pay-mark";
import { CompForm } from "@/components/door/comp-form";
import { DoorReceiptPrompt } from "@/components/door/receipt-prompt";

type PaymentMethod = "TAP_TO_PAY" | "CASH" | "TERMINAL";

/**
 * Selling to somebody at the door with no ticket.
 *
 * Cash and eftpos are a *record* of a sale that already happened — the staffer
 * took the money before pressing anything, so nothing can fail between taking
 * it and issuing the ticket, and `sellAtDoor` mints in one call.
 *
 * Tap to Pay is a different shape: the money moves inside this flow and can
 * decline, so it runs through its own two-step path where no ticket exists
 * until the server has seen the payment succeed. Hence the separate sheet
 * rather than a third value on the same button.
 *
 * The layout is shaped by Apple's App Review checklist as much as by the door:
 *
 * - **5.2** Tap to Pay is first in the list of payment options, and the whole
 *   payment block is pinned to the bottom of the screen so it can never be
 *   scrolled off — an event with a dozen tiers must not push it under the fold.
 * - **5.3** the Tap to Pay option is *always* rendered, never greyed out and
 *   never hidden, whatever state the reader is in. Choosing it when the handset
 *   has not been set up opens the Terms and Conditions rather than failing.
 * - **5.4 / 1.9** it is called "Tap to Pay on iPhone", in full, every time.
 * - **5.5** the icon is Apple's own `wave.3.right.circle.fill` SF Symbol.
 */
export default function SellScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<PaymentMethod>("TAP_TO_PAY");
  const [receipt, setReceipt] = useState<{
    kind: "sale" | "comp";
    reference: string;
    receiptId?: string;
  } | null>(null);
  const [tapping, setTapping] = useState(false);
  const [mode, setMode] = useState<"SELL" | "COMP">("SELL");

  const { deviceLabel } = useDeviceLabel();
  const tapToPay = useTapToPay();

  const summary = api.door.summary.useQuery(
    { eventId },
    { enabled: !!eventId, refetchInterval: 15_000 },
  );
  const tiers = api.door.sellableTiers.useQuery({ eventId });
  const utils = api.useUtils();

  const lines = useMemo(
    () =>
      Object.entries(quantities)
        .filter(([, quantity]) => quantity > 0)
        .map(([tierId, quantity]) => ({ tierId, quantity })),
    [quantities],
  );

  const totalCents = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const tier = tiers.data?.find((entry) => entry.id === line.tierId);
        return sum + (tier?.priceCents ?? 0) * line.quantity;
      }, 0),
    [lines, tiers.data],
  );

  const ticketCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  const sell = api.door.sellAtDoor.useMutation({
    onSuccess: (result) => {
      setReceipt({ kind: "sale", reference: result.orderNumber });
      setQuantities({});
      void summary.refetch();
      void utils.door.doorList.invalidate();
      void utils.door.orderTickets.invalidate();
    },
  });

  /**
   * Checklist 5.3 — pressing Tap to Pay when it is not yet enabled must lead to
   * acceptance, not to a dead end. An admin gets Apple's sheet directly; anybody
   * else is sent to the hub, which tells them to find one (3.8.1).
   */
  const startSetUp = useCallback(() => {
    const state = tapToPay.state;
    if (state.status === "needs-setup" && state.canAccept) {
      void tapToPay.acceptTerms().catch(() => undefined);
      return;
    }
    router.push("/(door)/tap-to-pay");
  }, [tapToPay, router]);

  if (receipt) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <DoorHeader eventId={eventId} summary={summary.data} active="sell" />
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
          <Notice
            title={receipt.kind === "comp" ? "Comped and in" : "Sold and in"}
            detail={`${
              receipt.kind === "comp" ? "Ticket" : "Order"
            } ${receipt.reference}. They are counted as inside.`}
            action={<Button onPress={() => setReceipt(null)}>Next</Button>}
          />
          {/* Checklist 5.10 — a receipt has to be offered for card sales. */}
          {receipt.receiptId ? (
            <DoorReceiptPrompt receiptId={receipt.receiptId} />
          ) : null}
        </ScrollView>
      </View>
    );
  }

  const available = (tiers.data ?? []).filter((tier) => tier.remaining > 0);
  const tapReady = tapToPay.isReady;
  const showPayment = mode === "SELL" && ticketCount > 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <DoorHeader eventId={eventId} summary={summary.data} active="sell" />

      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        {/* Comping is a separate mode rather than a third payment method,
            because it is a different act: nothing is drawn from a tier, a level
            is picked directly, and the ticket goes out in somebody's name. */}
        {summary.data?.isManager ? (
          <View style={{ flexDirection: "row", gap: space.sm }}>
            {(
              [
                { value: "SELL", label: "Sell" },
                { value: "COMP", label: "Comp" },
              ] as const
            ).map((tab) => (
              <Pressable
                key={tab.value}
                onPress={() => setMode(tab.value)}
                style={[styles.tab, mode === tab.value && styles.tabActive]}
              >
                <Text
                  style={[
                    styles.methodLabel,
                    mode === tab.value && { color: "#000" },
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {mode === "COMP" ? (
          <CompForm
            eventId={eventId}
            deviceLabel={deviceLabel || undefined}
            onIssued={(ticketNumber) => {
              setReceipt({ kind: "comp", reference: ticketNumber });
              void summary.refetch();
              void utils.door.doorList.invalidate();
            }}
          />
        ) : tiers.isPending ? (
          <Loading />
        ) : available.length === 0 ? (
          <Notice title="Nothing left to sell" detail="Every tier is out." />
        ) : (
          <View style={{ gap: space.sm }}>
            {available.map((tier) => {
              const quantity = quantities[tier.id] ?? 0;
              return (
                <View key={tier.id} style={styles.tier}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Body style={{ fontWeight: "600" }}>{tier.name}</Body>
                    <Caption>
                      {tier.priceCents === 0
                        ? "Free"
                        : `$${(tier.priceCents / 100).toFixed(2)}`}{" "}
                      · {tier.remaining} left
                    </Caption>
                  </View>
                  <Stepper
                    value={quantity}
                    max={Math.min(tier.remaining, 20)}
                    onChange={(next) =>
                      setQuantities((current) => ({
                        ...current,
                        [tier.id]: next,
                      }))
                    }
                  />
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/*
        Pinned, not scrolled. Checklist 5.2 requires the Tap to Pay button to be
        reachable "without requiring scrolling" — which cannot be promised from
        inside a list whose length is set by however many tiers an event has.
      */}
      {showPayment ? (
        <View style={styles.footer}>
          <Caption>How are they paying?</Caption>

          <View style={{ gap: space.sm }}>
            <MethodRow
              label="Tap to Pay on iPhone"
              hint={
                tapReady
                  ? "Card, Apple Pay or Google Pay on this phone"
                  : "Tap to set it up on this iPhone"
              }
              icon={
                <TapToPayMark
                  size={20}
                  color={method === "TAP_TO_PAY" ? "#000" : colors.text}
                />
              }
              selected={method === "TAP_TO_PAY"}
              onPress={() => setMethod("TAP_TO_PAY")}
            />
            <MethodRow
              label="Cash"
              hint="Recorded as already paid"
              selected={method === "CASH"}
              onPress={() => setMethod("CASH")}
            />
            <MethodRow
              label="Eftpos"
              hint="Recorded as already paid"
              selected={method === "TERMINAL"}
              onPress={() => setMethod("TERMINAL")}
            />
          </View>

          <View style={styles.total}>
            <Body style={{ fontWeight: "700" }}>
              {ticketCount === 1 ? "1 ticket" : `${ticketCount} tickets`}
            </Body>
            <Body style={{ fontWeight: "700" }}>
              ${(totalCents / 100).toFixed(2)}
            </Body>
          </View>

          {method === "TAP_TO_PAY" ? (
            tapReady ? (
              <Button onPress={() => setTapping(true)}>
                {`Charge $${(totalCents / 100).toFixed(2)} with Tap to Pay on iPhone`}
              </Button>
            ) : (
              /*
                Never greyed out (5.3). If the handset is not set up, the button
                is the way *in* to setting it up rather than a locked door — and
                for a state that no button can fix, it still opens the screen
                that explains why.
              */
              <Button onPress={startSetUp}>
                {tapToPay.state.status === "needs-setup"
                  ? "Set up Tap to Pay on iPhone"
                  : "Tap to Pay on iPhone — see status"}
              </Button>
            )
          ) : (
            <Button
              loading={sell.isPending}
              onPress={() =>
                sell.mutate({
                  eventId,
                  lines,
                  paymentMethod: method,
                  admitNow: true,
                })
              }
            >
              {`Took $${(totalCents / 100).toFixed(2)} — issue ${
                ticketCount === 1 ? "ticket" : "tickets"
              }`}
            </Button>
          )}
        </View>
      ) : null}

      {tapping ? (
        <TapToPaySheet
          eventId={eventId}
          deviceLabel={deviceLabel || undefined}
          lines={lines}
          totalCents={totalCents}
          onClose={() => setTapping(false)}
          onSold={(orderNumber, receiptId) => {
            setTapping(false);
            setReceipt({ kind: "sale", reference: orderNumber, receiptId });
            setQuantities({});
            void summary.refetch();
            void utils.door.doorList.invalidate();
            void utils.door.orderTickets.invalidate();
          }}
        />
      ) : null}
    </View>
  );
}

/**
 * One payment option.
 *
 * A row rather than a chip because the full product name has to fit — Apple's
 * marketing guidelines do not allow "Tap to Pay on iPhone" abbreviated to
 * "Tap", which is what the horizontal three-up layout this replaced forced.
 */
function MethodRow({
  label,
  hint,
  icon,
  selected,
  onPress,
}: {
  label: string;
  hint: string;
  icon?: ReactNode;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.method, selected && styles.methodActive]}
    >
      {icon ? <View style={{ width: 22 }}>{icon}</View> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.methodLabel, selected && { color: "#000" }]}>
          {label}
        </Text>
        <Text style={[styles.methodHint, selected && { color: "#000" }]}>
          {hint}
        </Text>
      </View>
    </Pressable>
  );
}

function Stepper({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={() => onChange(Math.max(0, value - 1))}
        disabled={value === 0}
        style={styles.stepBtn}
      >
        <Minus color={colors.text} size={16} strokeWidth={3} />
      </Pressable>
      <Text style={styles.stepValue}>{value}</Text>
      <Pressable
        onPress={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        style={styles.stepBtn}
      >
        <Plus color={colors.text} size={16} strokeWidth={3} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  tier: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  stepper: { flexDirection: "row", alignItems: "center", gap: space.sm },
  stepBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
  },
  stepValue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
    minWidth: 28,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  tab: {
    flex: 1,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.sm,
  },
  tabActive: { backgroundColor: colors.text, borderColor: colors.text },
  method: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 52,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.sm,
  },
  methodActive: { backgroundColor: colors.text, borderColor: colors.text },
  methodLabel: { color: colors.text, fontSize: 15, fontWeight: "700" },
  methodHint: { color: colors.textFaint, fontSize: 12, marginTop: 1 },
  total: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: space.md,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.border,
  },
  footer: {
    padding: space.lg,
    paddingBottom: space.xl,
    gap: space.md,
    backgroundColor: colors.bg,
    borderTopWidth: stroke.hard,
    borderTopColor: colors.border,
  },
});
