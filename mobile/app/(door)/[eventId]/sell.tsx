import { useMemo, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { api } from "@/lib/api";
import { colors, radius, space } from "@/lib/theme";
import { Body, Button, Caption, Loading, Notice } from "@/components/ui";
import { DoorHeader } from "@/components/door/door-header";
import { TapToPaySheet } from "@/components/door/tap-to-pay";
import { CompForm } from "@/components/door/comp-form";

type PaymentMethod = "CASH" | "TERMINAL" | "TAP_TO_PAY";

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
 */
export default function SellScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [receipt, setReceipt] = useState<{
    kind: "sale" | "comp";
    reference: string;
  } | null>(null);
  const [tapping, setTapping] = useState(false);
  const [mode, setMode] = useState<"SELL" | "COMP">("SELL");

  const summary = api.door.summary.useQuery({ eventId }, { enabled: !!eventId });
  const tiers = api.door.sellableTiers.useQuery({ eventId });
  const terminal = api.terminal.config.useQuery(undefined, { retry: false });
  const utils = api.useUtils();

  // Hidden rather than shown-and-broken when Stripe is not configured — a
  // payment button that always fails is worse than no button.
  const tapAvailable = terminal.data?.available ?? false;

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

  if (receipt) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <DoorHeader eventId={eventId} summary={summary.data} active="sell" />
        <View style={{ padding: space.lg }}>
          <Notice
            title={receipt.kind === "comp" ? "Comped and in" : "Sold and in"}
            detail={`${
              receipt.kind === "comp" ? "Ticket" : "Order"
            } ${receipt.reference}. They are counted as inside.`}
            action={<Button onPress={() => setReceipt(null)}>Next</Button>}
          />
        </View>
      </View>
    );
  }

  const available = (tiers.data ?? []).filter((tier) => tier.remaining > 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <DoorHeader eventId={eventId} summary={summary.data} active="sell" />

      <ScrollView
        contentContainerStyle={{ padding: space.lg, gap: space.lg }}
      >
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
                style={[styles.method, mode === tab.value && styles.methodActive]}
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

        {mode === "SELL" && ticketCount > 0 ? (
          <>
            <View style={{ gap: space.sm }}>
              <Caption>How are they paying?</Caption>
              <View style={{ flexDirection: "row", gap: space.sm }}>
                {(
                  [
                    { value: "CASH", label: "Cash" },
                    { value: "TERMINAL", label: "Eftpos" },
                    ...(tapAvailable
                      ? [{ value: "TAP_TO_PAY", label: "Tap" } as const]
                      : []),
                  ] as { value: PaymentMethod; label: string }[]
                ).map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() => setMethod(option.value)}
                    style={[
                      styles.method,
                      method === option.value && styles.methodActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.methodLabel,
                        method === option.value && { color: "#000" },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {method === "TAP_TO_PAY" ? (
                <Caption>
                  They tap their card or phone against this handset. The ticket
                  is only issued once the payment goes through.
                </Caption>
              ) : (
                <Caption>
                  Recorded as already paid — take the money first.
                </Caption>
              )}
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
              <Button onPress={() => setTapping(true)}>
                {`Charge $${(totalCents / 100).toFixed(2)} by tap`}
              </Button>
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
          </>
        ) : null}
      </ScrollView>

      {tapping ? (
        <TapToPaySheet
          eventId={eventId}
          lines={lines}
          totalCents={totalCents}
          onClose={() => setTapping(false)}
          onSold={(orderNumber) => {
            setTapping(false);
            setReceipt({ kind: "sale", reference: orderNumber });
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
        <Text style={styles.stepLabel}>−</Text>
      </Pressable>
      <Text style={styles.stepValue}>{value}</Text>
      <Pressable
        onPress={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        style={styles.stepBtn}
      >
        <Text style={styles.stepLabel}>+</Text>
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
  stepLabel: { color: colors.text, fontSize: 20, fontWeight: "700" },
  stepValue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
    minWidth: 28,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  method: {
    flex: 1,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.sm,
  },
  methodActive: { backgroundColor: colors.text, borderColor: colors.text },
  methodLabel: { color: colors.textSoft, fontSize: 15, fontWeight: "700" },
  total: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: space.md,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.border,
  },
});
