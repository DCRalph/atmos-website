import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";

import { api } from "@/lib/api";
import { formatNZD } from "~/lib/ticketing/money";
import { paymentMethodLabel } from "~/lib/ticketing/payment-methods";
import { scanResultShort } from "~/lib/ticketing/scan-results";
import { scanToneColor } from "@/lib/scan-tone";
import { formatTimeAgo } from "@/lib/dates";
import { colors, space, stroke } from "@/lib/theme";
import { Body, Caption, Loading, Notice } from "@/components/ui";
import {
  LineItem,
  MeterBar,
  MiniBars,
  Section,
  Stat,
  StatGrid,
} from "@/components/admin/stat";

type Tab = "live" | "sales";

/**
 * One event, in numbers.
 *
 * Split rather than stacked, and live is the default. The two views answer
 * questions asked hours apart — "how is the room filling" is a thing you check
 * every few minutes with the venue in front of you, "did this event make
 * money" is a thing you read once, sitting down. Loading both would also mean
 * five queries on open and a poll cycle over data nobody is looking at.
 */
export default function EventAnalyticsScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("live");

  const overview = api.ticketAnalytics.overview.useQuery(
    { eventId },
    { enabled: !!eventId, retry: false },
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ArrowLeft color={colors.text} size={22} strokeWidth={2.5} />
          </Pressable>
          <Text numberOfLines={1} style={styles.title}>
            {overview.data?.event.name ?? "Event"}
          </Text>
        </View>

        <View style={styles.tabs}>
          {(["live", "sales"] as const).map((value) => (
            <Pressable
              key={value}
              onPress={() => setTab(value)}
              style={[styles.tab, tab === value && styles.tabActive]}
            >
              <Text
                style={[styles.tabLabel, tab === value && { color: "#000" }]}
              >
                {value === "live" ? "Live" : "Sales"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {overview.isError ? (
        <View style={{ padding: space.lg }}>
          <Notice
            title="Can't load this event"
            detail={overview.error.message}
          />
        </View>
      ) : tab === "live" ? (
        <LiveTab eventId={eventId} />
      ) : (
        <SalesTab eventId={eventId} />
      )}
    </View>
  );
}

/**
 * The room, right now.
 *
 * Polled on a ten-second cycle: the underlying procedure is a handful of
 * aggregates written for exactly this, and a number that lags a minute behind
 * the door is a number somebody makes a decision on.
 */
function LiveTab({ eventId }: { eventId: string }) {
  const live = api.ticketAnalytics.live.useQuery(
    { eventId },
    { enabled: !!eventId, refetchInterval: 10_000, retry: false },
  );

  if (live.isPending) return <Loading label="Loading live view" />;
  if (!live.data) {
    return (
      <View style={{ padding: space.lg }}>
        <Notice title="No live data" />
      </View>
    );
  }

  const data = live.data;

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <View style={{ gap: space.sm }}>
        <View style={styles.headline}>
          <Text style={styles.headlineValue}>{data.admitted}</Text>
          <Text style={styles.headlineTotal}>/{data.sold} in</Text>
        </View>
        <MeterBar percent={data.percentIn} />
        <Caption>
          {data.notArrived} still to come · {data.percentIn}% of tickets used
        </Caption>
      </View>

      <StatGrid>
        <Stat
          label="Arrivals per minute"
          value={data.arrivalsPerMinute.toFixed(1)}
          hint="Averaged over the last 15 minutes"
        />
        <Stat label="Not arrived" value={String(data.notArrived)} />
      </StatGrid>

      {data.arrivals.length > 0 ? (
        <Section
          title="Arrivals"
          hint="Five-minute buckets, last six hours. Oldest on the left."
        >
          <MiniBars values={data.arrivals.map((bucket) => bucket.count)} />
        </Section>
      ) : null}

      {data.byStaff.length > 0 ? (
        <Section title="Who is scanning">
          <View>
            {data.byStaff.map((row, index) => (
              <LineItem
                key={`${row.name}-${row.deviceLabel ?? index}`}
                label={row.name}
                sub={row.deviceLabel}
                value={String(row.count)}
              />
            ))}
          </View>
        </Section>
      ) : null}

      {data.problems.length > 0 ? (
        <Section
          title="Problem scans"
          hint="Every scan that did not admit somebody, for the whole event."
        >
          <View>
            {data.problems.map((row) => (
              <LineItem
                key={row.result}
                label={scanResultShort(row.result)}
                value={String(row.count)}
                valueTone={scanToneColor(row.result)}
              />
            ))}
          </View>
        </Section>
      ) : null}

      {data.recent.length > 0 ? (
        <Section title="Latest scans">
          <View style={{ gap: space.sm }}>
            {data.recent.map((scan) => (
              <View key={scan.id} style={styles.scanRow}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: scanToneColor(scan.result) },
                  ]}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Body numberOfLines={1} style={{ fontSize: 14 }}>
                    {scan.ticket?.attendeeName ??
                      scan.ticket?.ticketNumber ??
                      "Unknown code"}
                  </Body>
                  <Caption numberOfLines={1}>
                    {[
                      scanResultShort(scan.result),
                      scan.wasOverride ? "override" : null,
                      scan.scannedByName,
                      scan.deviceLabel,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Caption>
                </View>
                <Caption>{formatTimeAgo(new Date(scan.createdAt))}</Caption>
              </View>
            ))}
          </View>
        </Section>
      ) : null}
    </ScrollView>
  );
}

/** What the event sold, and what it made. */
function SalesTab({ eventId }: { eventId: string }) {
  const overview = api.ticketAnalytics.overview.useQuery(
    { eventId },
    { enabled: !!eventId, retry: false },
  );
  const discounts = api.ticketAnalytics.discountPerformance.useQuery(
    { eventId },
    { enabled: !!eventId, retry: false },
  );
  const sources = api.ticketAnalytics.sources.useQuery(
    { eventId },
    { enabled: !!eventId, retry: false },
  );
  const sales = api.ticketAnalytics.salesOverTime.useQuery(
    { eventId, bucket: "day" },
    { enabled: !!eventId, retry: false },
  );

  if (overview.isPending) return <Loading label="Loading sales" />;
  if (!overview.data) {
    return (
      <View style={{ padding: space.lg }}>
        <Notice title="No sales data" />
      </View>
    );
  }

  const { money, counts, tiers, byPaymentMethod, comps } = overview.data;

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <StatGrid>
        <Stat
          label="Net revenue"
          value={formatNZD(money.netCents)}
          hint={
            money.refundedCents > 0
              ? `${formatNZD(money.grossCents)} gross · ${formatNZD(money.refundedCents)} refunded`
              : "Nothing refunded"
          }
        />
        <Stat
          label="Sold"
          value={`${counts.percentSold}%`}
          hint={`${counts.ticketsIssued} of ${counts.capacity} capacity`}
        />
        <Stat
          label="Tickets sold"
          value={String(counts.sold)}
          hint={counts.comped > 0 ? `plus ${counts.comped} comped` : undefined}
        />
        <Stat
          label="Orders"
          value={String(counts.orders)}
          hint={
            counts.checkoutConversion !== null
              ? `${counts.checkoutConversion}% of checkouts completed`
              : undefined
          }
        />
        <Stat
          label="Turned up"
          value={`${counts.attendanceRate}%`}
          hint={`${counts.admitted} in · ${counts.notArrived} no-show`}
        />
        <Stat
          label="Abandoned"
          value={String(counts.abandonedCheckouts)}
          hint="Reserved stock, never paid"
        />
      </StatGrid>

      <Section title="Where the money went">
        <View>
          <LineItem
            label="Face value"
            value={formatNZD(money.faceValueCents)}
          />
          {money.discountCents > 0 ? (
            <LineItem
              label="Discounts"
              value={`−${formatNZD(money.discountCents)}`}
              valueTone={colors.warn}
            />
          ) : null}
          <LineItem
            label="Booking fees"
            value={formatNZD(money.bookingFeeCents)}
          />
          <LineItem label="GST included" value={formatNZD(money.gstCents)} />
          {money.refundedCents > 0 ? (
            <LineItem
              label="Refunded"
              value={`−${formatNZD(money.refundedCents)}`}
              valueTone={colors.deny}
            />
          ) : null}
          <LineItem
            label="Net"
            value={formatNZD(money.netCents)}
            valueTone={colors.in}
          />
        </View>
      </Section>

      <Section title="Tiers">
        <View style={{ gap: space.md }}>
          {tiers.map((tier) => {
            const percent =
              tier.allocation > 0
                ? Math.round((tier.sold / tier.allocation) * 100)
                : 0;
            return (
              <View key={tier.id} style={{ gap: space.xs }}>
                <LineItem
                  label={tier.name}
                  sub={`${tier.sold}/${tier.allocation} · ${tier.remaining} left${
                    tier.held > 0 ? ` · ${tier.held} held` : ""
                  }`}
                  value={formatNZD(tier.revenueCents)}
                />
                <MeterBar
                  percent={percent}
                  tone={percent >= 100 ? colors.warn : colors.in}
                />
              </View>
            );
          })}
        </View>
      </Section>

      {/* Comps never touch revenue, so they get their own block rather than a
          line inside the money list where they would read as income. */}
      {counts.comped > 0 ? (
        <Section
          title="Comps"
          hint="Given away. Counted in tickets issued, never in revenue."
        >
          <View>
            <LineItem
              label="Issued"
              sub={
                counts.compAllowance
                  ? `of ${counts.compAllowance} allowed`
                  : null
              }
              value={String(comps.issued)}
            />
            <LineItem label="Turned up" value={String(counts.compsAdmitted)} />
            {counts.handoutsUnsent > 0 ? (
              <LineItem
                label="Hand-outs not sent"
                value={String(counts.handoutsUnsent)}
                valueTone={colors.warn}
              />
            ) : null}
          </View>
        </Section>
      ) : null}

      {byPaymentMethod.length > 0 ? (
        <Section title="How they paid">
          <View>
            {byPaymentMethod.map((row) => (
              <LineItem
                key={row.method}
                label={paymentMethodLabel(row.method)}
                sub={`${row.orders} ${row.orders === 1 ? "order" : "orders"}`}
                value={formatNZD(row.totalCents)}
              />
            ))}
          </View>
        </Section>
      ) : null}

      {sales.data && sales.data.length > 1 ? (
        <Section title="Sales by day" hint="Tickets sold per day, oldest left.">
          <MiniBars
            values={sales.data.map((row) => row.tickets)}
            tone={colors.left}
          />
        </Section>
      ) : null}

      {discounts.data && discounts.data.length > 0 ? (
        <Section title="Discount codes">
          <View>
            {discounts.data.map((row) => (
              <LineItem
                key={row.code}
                label={row.code}
                sub={`${row.uses} ${row.uses === 1 ? "use" : "uses"} · ${formatNZD(row.revenueCents)} of orders`}
                value={`−${formatNZD(row.givenCents)}`}
                valueTone={colors.warn}
              />
            ))}
          </View>
        </Section>
      ) : null}

      {sources.data && sources.data.length > 0 ? (
        <Section title="Where buyers came from">
          <View>
            {sources.data.map((row, index) => (
              <LineItem
                key={`${row.source}-${row.medium ?? ""}-${row.campaign ?? ""}-${index}`}
                label={row.source}
                sub={[row.medium, row.campaign].filter(Boolean).join(" · ") || null}
                value={`${row.orders} · ${formatNZD(row.revenueCents)}`}
              />
            ))}
          </View>
        </Section>
      ) : null}
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  header: {
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    borderBottomWidth: stroke.hard,
    borderBottomColor: colors.border,
    gap: space.sm,
  },
  headerTop: { flexDirection: "row", alignItems: "center", gap: space.md },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  tabs: { flexDirection: "row", gap: space.sm },
  tab: {
    flex: 1,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: stroke.hard,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.text, borderColor: colors.text },
  tabLabel: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  body: { padding: space.lg, paddingBottom: space.xxl * 2, gap: space.xl },
  headline: { flexDirection: "row", alignItems: "baseline" },
  headlineValue: {
    color: colors.text,
    fontSize: 56,
    fontWeight: "900",
    letterSpacing: -2.5,
    fontVariant: ["tabular-nums"],
  },
  headlineTotal: {
    color: colors.textFaint,
    fontSize: 22,
    fontWeight: "700",
  },
  scanRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderWidth: stroke.hair,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dot: { width: 8, height: 8 },
});
