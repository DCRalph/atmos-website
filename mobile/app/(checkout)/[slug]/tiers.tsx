import { useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/lib/api";
import { colors, radius, space } from "@/lib/theme";
import {
  Body,
  Button,
  Caption,
  Loading,
  Notice,
  Pill,
  Title,
} from "@/components/ui";

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** Pick tickets. Pricing comes from `quote`, so it can never drift from web. */
export default function TiersScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [accepted, setAccepted] = useState(false);

  // `bySlug` is the public accessor — it applies the visibility rules and
  // strips stock levels, which is why the app never sees raw counts.
  const event = api.ticketEvents.bySlug.useQuery(
    { slug },
    { enabled: !!slug },
  );
  const config = api.ticketCheckout.config.useQuery();
  const eventId = event.data?.id ?? "";

  const lines = useMemo(
    () =>
      Object.entries(quantities)
        .filter(([, quantity]) => quantity > 0)
        .map(([tierId, quantity]) => ({ tierId, quantity })),
    [quantities],
  );

  // Priced server-side on every change: discounts, booking fee and GST are
  // rules the app has no business reimplementing.
  const quote = api.ticketCheckout.quote.useQuery(
    { eventId, lines },
    { enabled: lines.length > 0 && !!eventId },
  );

  const start = api.ticketCheckout.start.useMutation({
    onSuccess: (order) => {
      router.replace({
        pathname: "/(checkout)/[slug]/pay",
        params: {
          slug,
          orderId: order.orderId,
          token: order.accessToken,
          clientSecret: order.clientSecret ?? "",
          total: String(order.totalCents),
          expiresAt: order.expiresAt
            ? new Date(order.expiresAt).toISOString()
            : "",
        },
      });
    },
  });

  const tiers = event.data?.tiers ?? [];
  const ticketCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  if (config.isPending) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
        <Title style={{ fontSize: 18 }}>Tickets</Title>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        {tiers.length === 0 ? (
          <Notice
            title="Nothing on sale"
            detail="Tickets for this event aren't available right now."
            action={<Button onPress={() => router.back()}>Back</Button>}
          />
        ) : (
          <View style={{ gap: space.sm }}>
            {tiers.map((tier) => {
              const quantity = quantities[tier.id] ?? 0;
              // Exact stock is deliberately not published; the server only
              // says "available", and how many are left once it is nearly out.
              const cap = Math.min(
                tier.maxPerOrder ?? 10,
                tier.remainingIfLow ?? 10,
              );
              return (
                <View key={tier.id} style={styles.tier}>
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <Body style={{ fontWeight: "700" }}>{tier.name}</Body>
                    {tier.description ? (
                      <Caption numberOfLines={2}>{tier.description}</Caption>
                    ) : null}
                    <Caption>
                      {tier.isFree ? "Free" : money(tier.priceCents)}
                    </Caption>
                    {!tier.available ? (
                      <Pill tone="deny">
                        {tier.unavailableReason ?? "Unavailable"}
                      </Pill>
                    ) : tier.lowStock ? (
                      <Pill tone="warn">{tier.remainingIfLow} left</Pill>
                    ) : null}
                  </View>
                  {tier.available ? (
                    <Stepper
                      value={quantity}
                      max={cap}
                      onChange={(next) =>
                        setQuantities((current) => ({
                          ...current,
                          [tier.id]: next,
                        }))
                      }
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
        )}

        {quote.data ? (
          <View style={styles.totals}>
            <Line label="Subtotal" value={money(quote.data.subtotalCents)} />
            {quote.data.discountCents > 0 ? (
              <Line
                label="Discount"
                value={`−${money(quote.data.discountCents)}`}
              />
            ) : null}
            {quote.data.bookingFeeCents > 0 ? (
              <Line
                label="Booking fee"
                value={money(quote.data.bookingFeeCents)}
              />
            ) : null}
            <View style={styles.rule} />
            <Line label="Total" value={money(quote.data.totalCents)} strong />
            <Caption>Includes GST of {money(quote.data.gstCents)}</Caption>
          </View>
        ) : null}

        {ticketCount > 0 ? (
          <Pressable
            onPress={() => setAccepted(!accepted)}
            style={styles.terms}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: accepted }}
          >
            <View style={[styles.box, accepted && styles.boxOn]}>
              {accepted ? <Text style={styles.tick}>✓</Text> : null}
            </View>
            <Caption style={{ flex: 1 }}>
              I accept the ticket terms. Tickets are non-refundable except as
              required by the Consumer Guarantees Act.
            </Caption>
          </Pressable>
        ) : null}
      </ScrollView>

      {ticketCount > 0 ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>
          {start.isError ? (
            <Caption style={{ color: colors.deny }}>
              {start.error.message}
            </Caption>
          ) : null}
          <Button
            disabled={!accepted || quote.isPending}
            loading={start.isPending}
            onPress={() =>
              start.mutate({ eventId, lines, acceptTerms: true })
            }
          >
            {quote.data
              ? `Pay ${money(quote.data.totalCents)}`
              : "Continue"}
          </Button>
          <Caption style={{ textAlign: "center" }}>
            Tickets are held for {config.data?.holdMinutes ?? 10} minutes once
            you continue.
          </Caption>
        </View>
      ) : null}
    </View>
  );
}

function Line({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.line}>
      <Body soft={!strong} style={strong ? { fontWeight: "700" } : undefined}>
        {label}
      </Body>
      <Body style={strong ? { fontWeight: "700" } : undefined}>{value}</Body>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  close: { color: colors.textSoft, fontSize: 20 },
  tier: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
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
  totals: { gap: space.sm },
  line: { flexDirection: "row", justifyContent: "space-between" },
  rule: { height: 1, backgroundColor: colors.border, marginVertical: space.xs },
  terms: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  box: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  boxOn: { backgroundColor: colors.text, borderColor: colors.text },
  tick: { color: "#000", fontSize: 14, fontWeight: "900" },
  footer: {
    padding: space.lg,
    gap: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
