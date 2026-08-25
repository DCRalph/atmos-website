import { useCallback, useState } from "react";
import { Link, useRouter } from "expo-router";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors, radius, space } from "@/lib/theme";
import { formatGigDate, formatGigTime } from "@/lib/dates";
import {
  Body,
  Button,
  Caption,
  Eyebrow,
  Header,
  Loading,
  Notice,
  Pill,
} from "@/components/ui";
import { VerifyBanner } from "@/components/verify-banner";

/**
 * My tickets.
 *
 * The app is not the thing you hold up at the door — a wallet pass is faster,
 * works offline and needs no sign-in. This is where you find tickets, get them
 * into the wallet, and manage them afterwards.
 */
export default function TicketsScreen() {
  const router = useRouter();
  const { user, isPending: sessionPending } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const mine = api.tickets.mine.useQuery(undefined, { enabled: !!user });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await mine.refetch();
    setRefreshing(false);
  }, [mine]);

  const now = Date.now();
  const orders = mine.data ?? [];
  const upcoming = orders.filter(
    (o) => new Date(o.event.startsAt).getTime() >= now,
  );
  const past = orders.filter((o) => new Date(o.event.startsAt).getTime() < now);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Tickets" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: space.lg,
          paddingBottom: space.xxl,
          paddingHorizontal: space.lg,
          gap: space.xl,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.textFaint}
          />
        }
      >
        {/* Sits above the list: an unverified account is the single most likely
          reason somebody's tickets are missing from it. */}
        <VerifyBanner />

        {sessionPending ? (
          <Loading />
        ) : !user ? (
          <Notice
            title="Sign in to see your tickets"
            detail="Tickets you already bought will appear here once your email is verified."
            action={
              <Button onPress={() => router.push("/(auth)/sign-in")}>
                Sign in
              </Button>
            }
          />
        ) : mine.isPending ? (
          <Loading />
        ) : orders.length === 0 ? (
          <Notice
            title="No tickets yet"
            detail={
              user.emailVerified
                ? "Anything you buy shows up here. Bought on another email? Add it with the link from your confirmation."
                : "Verify your email to see tickets you bought before installing the app."
            }
            action={
              <Button
                variant="outline"
                onPress={() => router.push("/(tabs)/gigs")}
              >
                See what's on
              </Button>
            }
          />
        ) : (
          <>
            {upcoming.length > 0 && (
              <View style={{ gap: space.md }}>
                <Eyebrow>Coming up</Eyebrow>
                {upcoming.map((order) => (
                  <OrderCard key={order.orderId} order={order} />
                ))}
              </View>
            )}
            {past.length > 0 && (
              <View style={{ gap: space.md }}>
                <Eyebrow>Been there</Eyebrow>
                {past.map((order) => (
                  <OrderCard key={order.orderId} order={order} past />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

type OrderSummary = {
  orderId: string;
  orderNumber: string;
  ticketCount: number;
  accessToken: string;
  event: {
    name: string;
    startsAt: Date;
    venueName: string | null;
    isR18: boolean;
  };
};

function OrderCard({ order, past }: { order: OrderSummary; past?: boolean }) {
  return (
    <Link
      href={{
        pathname: "/tickets/[orderId]",
        params: { orderId: order.orderId, token: order.accessToken },
      }}
      asChild
    >
      <Pressable>
        {({ pressed }) => (
          <View
            style={[
              styles.card,
              past && { opacity: 0.55 },
              pressed && { opacity: 0.8 },
            ]}
          >
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <Caption>
                {formatGigDate(order.event.startsAt)} ·{" "}
                {formatGigTime(order.event.startsAt)}
              </Caption>
              <Body numberOfLines={1} style={{ fontWeight: "700" }}>
                {order.event.name}
              </Body>
              <Caption numberOfLines={1}>
                {[
                  order.event.venueName,
                  `${order.ticketCount} ${order.ticketCount === 1 ? "ticket" : "tickets"}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Caption>
            </View>
            {order.event.isR18 && !past ? <Pill tone="warn">R18</Pill> : null}
          </View>
        )}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
});
