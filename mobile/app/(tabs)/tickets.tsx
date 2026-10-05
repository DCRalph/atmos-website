import { useCallback, useState } from "react";
import { useRouter } from "expo-router";
import { Animated, RefreshControl, View } from "react-native";

import { api, type RouterOutputs } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { mediaUrl } from "@/lib/media";
import { colors, space } from "@/lib/theme";
import { formatGigDate } from "@/lib/dates";
import { Button, Loading, Notice } from "@/components/ui";
import { Ambient } from "@/components/poster";
import { Pass, PassStrip } from "@/components/pass";
import { VerifyBanner } from "@/components/verify-banner";
import {
  LargeTitle,
  PinnedHeader,
  useScrollHeader,
} from "@/components/screen-header";
import { useTabBarSpace } from "@/components/tab-bar";

type OrderSummary = RouterOutputs["tickets"]["mine"][number];

/**
 * My tickets, stacked like Wallet.
 *
 * The soonest order is the pass at the front, QR and all, over its own
 * poster blurred out behind the screen. Later orders tuck in behind it as
 * strips; tapping one opens it. Past orders are a second shelf.
 *
 * The app is not the only thing you can hold up at the door: a wallet pass
 * is faster, works offline and needs no sign-in, so every pass offers one.
 */
export default function TicketsScreen() {
  const router = useRouter();
  const tabSpace = useTabBarSpace();
  const { scrollY, scrollProps } = useScrollHeader();
  const { user, isPending: sessionPending } = useAuth();
  const [showPast, setShowPast] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const mine = api.tickets.mine.useQuery(undefined, { enabled: !!user });

  const now = Date.now();
  const orders = mine.data ?? [];
  // The server sorts newest first; the stack wants the soonest at the front.
  const upcoming = orders
    .filter((o) => new Date(o.event.startsAt).getTime() >= now)
    .reverse();
  const past = orders.filter((o) => new Date(o.event.startsAt).getTime() < now);
  const front = showPast ? undefined : upcoming[0];

  const frontOrder = api.tickets.byAccessToken.useQuery(
    { accessToken: front?.accessToken ?? "" },
    { enabled: !!front },
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([mine.refetch(), front ? frontOrder.refetch() : null]);
    setRefreshing(false);
  }, [mine, front, frontOrder]);

  const open = (order: OrderSummary) =>
    router.push({
      pathname: "/tickets/[orderId]",
      params: { orderId: order.orderId, token: order.accessToken },
    });

  const poster = front?.event.posterFileUploadId;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Ambient uri={poster ? mediaUrl(poster) : null} />
      <Animated.ScrollView
        {...scrollProps}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: tabSpace }}
        refreshControl={
          user ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.textFaint}
            />
          ) : undefined
        }
      >
        <LargeTitle
          right={
            past.length > 0 ? (
              <Button
                variant="glass"
                size="sm"
                onPress={() => setShowPast((v) => !v)}
              >
                {showPast ? "Upcoming" : `Past ${past.length}`}
              </Button>
            ) : null
          }
        >
          {showPast ? "Past" : "Tickets"}
        </LargeTitle>

        <View
          style={{
            paddingHorizontal: space.lg,
            paddingTop: space.xl,
            gap: space.lg,
          }}
        >
          {/* Above the list: an unverified account is the single most likely
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
          ) : showPast ? (
            <View>
              {past.map((order) => (
                <PassStrip
                  key={order.orderId}
                  stacked={false}
                  name={order.event.name}
                  note={formatGigDate(order.event.startsAt)}
                  posterFileUploadId={order.event.posterFileUploadId}
                  onPress={() => open(order)}
                />
              ))}
            </View>
          ) : !front ? (
            <Notice
              title={orders.length ? "Nothing coming up" : "No tickets yet"}
              detail={
                user.emailVerified
                  ? "Anything you buy shows up here. Bought on another email? Add it with the link from your confirmation."
                  : "Verify your email to see tickets you bought before installing the app."
              }
              action={
                <Button
                  variant="outline"
                  onPress={() => router.navigate("/(tabs)/gigs")}
                >
                  See what&apos;s on
                </Button>
              }
            />
          ) : (
            <View>
              {/* Furthest away at the back, so the stack reads top-down in
                  the order the nights come. */}
              {upcoming
                .slice(1)
                .reverse()
                .map((order) => (
                  <PassStrip
                    key={order.orderId}
                    name={order.event.name}
                    note={formatGigDate(order.event.startsAt)}
                    posterFileUploadId={order.event.posterFileUploadId}
                    onPress={() => open(order)}
                  />
                ))}
              {frontOrder.data ? (
                <Pass order={frontOrder.data} />
              ) : frontOrder.isPending ? (
                <Loading label="Loading tickets" />
              ) : (
                <Notice
                  title="Couldn't open that order"
                  detail="Pull down to try again."
                />
              )}
            </View>
          )}
        </View>
      </Animated.ScrollView>

      <PinnedHeader scrollY={scrollY} title={showPast ? "Past" : "Tickets"} />
    </View>
  );
}
