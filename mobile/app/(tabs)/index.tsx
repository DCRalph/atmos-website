import { useCallback, useState } from "react";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import {
  Animated,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowRight,
  ArrowUpRight,
  MapPin,
  Ticket,
  User,
} from "lucide-react-native";

import { api, type RouterOutputs } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors, space, type } from "@/lib/theme";
import { formatGigDate, formatGigTime } from "@/lib/dates";
import { formatNZDCompact } from "~/lib/ticketing/money";
import {
  Button,
  Display,
  Eyebrow,
  Heading,
  IconButton,
  Loading,
  Notice,
  Pill,
} from "@/components/ui";
import { Poster, Scrim } from "@/components/poster";
import { CountdownTiles } from "@/components/countdown";
import { GigRows } from "@/components/gig-card";
import {
  HEADER_HEIGHT,
  HEADER_TAIL,
  PinnedHeader,
  useScrollHeader,
} from "@/components/screen-header";
import { useTabBarSpace } from "@/components/tab-bar";

/**
 * Home.
 *
 * The site's home, at phone size: the next gig's poster takes the screen with
 * the countdown in glass over it, then the rest of what's coming in the site's
 * month-grouped rows, then the latest mixes. The wordmark stays pinned at the
 * top, and gains a black bar once the poster has scrolled away under it.
 */
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const tabSpace = useTabBarSpace();
  const { scrollY, scrollProps } = useScrollHeader();
  const [refreshing, setRefreshing] = useState(false);
  const [heroTextTop, setHeroTextTop] = useState<number | null>(null);

  const { user } = useAuth();
  const upcoming = api.gigs.getUpcoming.useQuery();
  const latest = api.homeContent.getHomeLatest.useQuery();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([upcoming.refetch(), latest.refetch()]);
    setRefreshing(false);
  }, [upcoming, latest]);

  const [next, ...rest] = upcoming.data ?? [];
  const heroHeight = Math.round(height * 0.78);

  // On a phone the featured/list split buys nothing; one run of rows.
  const latestItems = [
    ...(latest.data?.featuredItem ? [latest.data.featuredItem] : []),
    ...(latest.data?.items ?? []),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Animated.ScrollView
        {...scrollProps}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: tabSpace }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.textFaint}
          />
        }
      >
        {next ? (
          <Hero gig={next} height={heroHeight} onTextTop={setHeroTextTop} />
        ) : (
          <View
            style={{
              paddingTop: insets.top + HEADER_HEIGHT + space.xl,
              paddingHorizontal: space.lg,
            }}
          >
            {upcoming.isPending ? (
              <Loading label="Loading gigs" />
            ) : upcoming.isError ? (
              <Notice
                title="Couldn't load gigs"
                detail="Check your connection and pull down to try again."
              />
            ) : (
              <Notice
                title="Nothing announced yet"
                detail="New dates land here first."
              />
            )}
          </View>
        )}

        {rest.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader
              title="Upcoming"
              action="All gigs"
              onPress={() => router.navigate("/(tabs)/gigs")}
            />
            <GigRows gigs={rest} />
          </View>
        ) : null}

        {latestItems.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="Latest" />
            {latestItems.map((item) => (
              <ContentRow key={item.id} item={item} />
            ))}
          </View>
        ) : null}
      </Animated.ScrollView>

      <PinnedHeader
        scrollY={scrollY}
        shade={!!next}
        // Solid by the time the hero's text reaches the bar's faded edge;
        // until then only the poster passes under it.
        solidAt={
          next
            ? (heroTextTop ?? heroHeight / 2) -
              (insets.top + HEADER_HEIGHT + HEADER_TAIL)
            : 10
        }
        left={
          // The same wordmark the site's nav uses, not a typeset approximation.
          <Image
            source={require("../../assets/atmos-wordmark.png")}
            style={styles.wordmark}
            contentFit="contain"
            accessibilityLabel="Atmos"
          />
        }
        right={
          <IconButton
            label={user ? "Account" : "Sign in"}
            icon={User}
            onPress={() =>
              router.push(user ? "/(tabs)/more" : "/(auth)/sign-in")
            }
          />
        }
      />
    </View>
  );
}

type UpcomingGig = RouterOutputs["gigs"]["getUpcoming"][number];

/** The next gig's poster, full bleed, with what you need to act on it. */
function Hero({
  gig,
  height,
  onTextTop,
}: {
  gig: UpcomingGig;
  height: number;
  /** Where the hero's text starts, so the header can be solid before it. */
  onTextTop: (y: number) => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const mine = api.tickets.mine.useQuery(undefined, { enabled: !!user });
  const event = api.ticketEvents.forGig.useQuery(
    { gigId: gig.id },
    { enabled: !gig.isTba },
  );

  const order = mine.data?.find((o) => o.event.gigId === gig.id);
  const started = !gig.isTba && gig.gigStartTime.getTime() <= Date.now();
  const onSale =
    event.data &&
    event.data.status !== "CANCELLED" &&
    event.data.status !== "SOLD_OUT";

  return (
    <View style={{ height }}>
      <Poster
        uri={gig.posterFileUpload?.url}
        tba={gig.isTba}
        tbaSize={48}
        style={StyleSheet.absoluteFill}
      />
      <Scrim from={0.3} />
      <View
        style={styles.heroBody}
        onLayout={(e) => onTextTop(e.nativeEvent.layout.y)}
      >
        {started ? (
          <Pill tone="accent">On now</Pill>
        ) : (
          <Eyebrow style={{ color: colors.textSoft }}>
            {gig.isTba
              ? "Next up · Date TBA"
              : `Next up · ${formatGigDate(gig.gigStartTime)} · ${formatGigTime(gig.gigStartTime)}`}
          </Eyebrow>
        )}
        <Display
          // Titles are often whole line-ups; long ones step down a size.
          size={gig.title.length > 28 ? 28 : 36}
          keepCase
          numberOfLines={3}
          style={{ marginTop: space.md }}
        >
          {gig.isTba ? "TBA" : gig.title}
        </Display>
        {gig.subtitle && !gig.isTba ? (
          <View style={styles.venue}>
            <MapPin color={colors.textSoft} size={14} strokeWidth={2} />
            <Text style={styles.venueLabel}>{gig.subtitle}</Text>
          </View>
        ) : null}

        {!gig.isTba && !started ? (
          <View style={{ marginTop: space.lg }}>
            <CountdownTiles target={gig.gigStartTime} />
          </View>
        ) : null}

        <View style={styles.ctas}>
          {order ? (
            <Button
              variant="accent"
              icon={Ticket}
              style={{ flex: 1 }}
              onPress={() =>
                router.push({
                  pathname: "/tickets/[orderId]",
                  params: { orderId: order.orderId, token: order.accessToken },
                })
              }
            >
              {order.ticketCount === 1
                ? "Your ticket"
                : `Your ${order.ticketCount} tickets`}
            </Button>
          ) : onSale ? (
            <Button
              variant="accent"
              style={{ flex: 1 }}
              onPress={() =>
                router.push({
                  pathname: "/(checkout)/[slug]/tiers",
                  params: { slug: event.data!.slug },
                })
              }
            >
              {event.data!.fromPriceCents === 0
                ? "Free tickets"
                : event.data!.fromPriceCents !== null
                  ? `Tickets from ${formatNZDCompact(event.data!.fromPriceCents)}`
                  : "Get tickets"}
            </Button>
          ) : null}
          <Button
            variant="glass"
            style={!order && !onSale ? { flex: 1 } : undefined}
            onPress={() => router.push(`/gigs/${gig.id}`)}
          >
            Gig info
          </Button>
        </View>
      </View>
    </View>
  );
}

/** Orbitron section heading, with an outline pill out to the full list. */
function SectionHeader({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Heading size={30}>{title}</Heading>
      {action && onPress ? (
        <Button variant="outline" size="sm" icon={ArrowRight} onPress={onPress}>
          {action}
        </Button>
      ) : null}
    </View>
  );
}

type ContentItem =
  RouterOutputs["homeContent"]["getHomeLatest"]["items"][number];

/**
 * A mix, video or post, as the site's latest-content rows. These live on
 * somebody else's platform, so the row opens an in-app browser rather than
 * pretending to host the thing.
 */
function ContentRow({ item }: { item: ContentItem }) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => {
        void WebBrowser.openBrowserAsync(item.link, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
          controlsColor: colors.text,
          toolbarColor: colors.bg,
        });
      }}
      style={({ pressed }) => [styles.contentRow, pressed && { opacity: 0.7 }]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.contentMeta}>
          <Text style={styles.chip}>{item.type}</Text>
          <Eyebrow>
            {[item.platform, formatGigDate(item.date)]
              .filter(Boolean)
              .join(" · ")}
          </Eyebrow>
        </View>
        <Display
          size={18}
          keepCase
          numberOfLines={2}
          style={{ marginTop: space.md }}
        >
          {item.title}
        </Display>
        {item.dj ? <Text style={styles.contentDj}>with {item.dj}</Text> : null}
      </View>
      <ArrowUpRight color={colors.textFaint} size={18} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // 5001x1120 in the source file — the ratio is pinned so the mark never
  // stretches.
  wordmark: { width: 104, aspectRatio: 5001 / 1120 },
  heroBody: {
    position: "absolute",
    left: space.lg,
    right: space.lg,
    bottom: space.sm,
  },
  venue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: space.md,
  },
  venueLabel: { ...type.body, color: colors.textSoft },
  ctas: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  section: { paddingHorizontal: space.lg, paddingTop: space.xxl + space.lg },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: space.md,
    marginBottom: space.xl,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.lg,
    paddingVertical: space.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderStrong,
  },
  contentMeta: { flexDirection: "row", alignItems: "center", gap: space.md },
  chip: {
    ...type.label,
    fontSize: 9,
    color: colors.textSoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    overflow: "hidden",
  },
  contentDj: { ...type.caption, color: colors.textSoft, marginTop: space.sm },
});
