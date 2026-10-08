import { useCallback, useState } from "react";
import { useRouter } from "expo-router";
import { Animated, RefreshControl, View } from "react-native";
import Reanimated, { FadeIn, LinearTransition } from "react-native-reanimated";

import { api } from "@/lib/api";
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

/**
 * My tickets, stacked like Wallet.
 *
 * One order at a time is open as a full pass, QR and all, over its own
 * poster blurred out behind the screen; the rest are strips. Tapping a strip
 * opens it in place, and its tickets swipe sideways inside the pass. Upcoming
 * opens on the soonest night; past orders are a second shelf that opens on
 * nothing.
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
  const [openId, setOpenId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const mine = api.tickets.mine.useQuery(undefined, { enabled: !!user });

  const now = Date.now();
  const orders = mine.data ?? [];
  // The server sorts newest first; the stack wants the soonest at the front.
  const upcoming = orders
    .filter((o) => new Date(o.event.startsAt).getTime() >= now)
    .reverse();
  const past = orders.filter((o) => new Date(o.event.startsAt).getTime() < now);
  // Furthest night at the back, so the stack reads top-down in the order the
  // nights come and the soonest sits at the front.
  const shelf = showPast ? past : [...upcoming].reverse();
  const open =
    shelf.find((o) => o.orderId === openId) ??
    (showPast ? undefined : upcoming[0]);

  const openOrder = api.tickets.byAccessToken.useQuery(
    { accessToken: open?.accessToken ?? "" },
    { enabled: !!open },
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([mine.refetch(), open ? openOrder.refetch() : null]);
    setRefreshing(false);
  }, [mine, open, openOrder]);

  const poster = open?.event.posterFileUploadId;

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
                onPress={() => {
                  setShowPast((v) => !v);
                  setOpenId(null);
                }}
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
          ) : shelf.length === 0 ? (
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
              {shelf.map((order, i) => {
                const isOpen = order.orderId === open?.orderId;
                const next = shelf[i + 1];
                return (
                  <Reanimated.View
                    key={order.orderId}
                    layout={LinearTransition.duration(220)}
                    style={
                      isOpen && next ? { marginBottom: space.lg } : undefined
                    }
                  >
                    {!isOpen ? (
                      <PassStrip
                        // Upcoming tucks under whatever follows, Wallet style;
                        // past is a plain list.
                        stacked={!showPast && !!next}
                        name={order.event.name}
                        note={formatGigDate(order.event.startsAt)}
                        posterFileUploadId={order.event.posterFileUploadId}
                        onPress={() => setOpenId(order.orderId)}
                      />
                    ) : openOrder.data?.orderId === order.orderId ? (
                      <Reanimated.View entering={FadeIn.duration(220)}>
                        <Pass order={openOrder.data} />
                      </Reanimated.View>
                    ) : openOrder.isError ? (
                      <Notice
                        title="Couldn't open that order"
                        detail="Pull down to try again."
                      />
                    ) : (
                      <Loading label="Loading tickets" />
                    )}
                  </Reanimated.View>
                );
              })}
            </View>
          )}
        </View>
      </Animated.ScrollView>

      <PinnedHeader scrollY={scrollY} title={showPast ? "Past" : "Tickets"} />
    </View>
  );
}
