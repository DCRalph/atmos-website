import { useCallback, useState } from "react";
import { Link } from "expo-router";
import { Image } from "expo-image";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronRight, User } from "lucide-react-native";

import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors, space, stroke } from "@/lib/theme";
import { Body, Caption, Eyebrow, Loading, Notice } from "@/components/ui";
import { GigTile, NextGigCard } from "@/components/gig-card";
import { ContentRow } from "@/components/content-row";

/**
 * Home.
 *
 * Content-first: the site opens with an animation and a full-bleed video
 * because it is competing with the whole internet for a click. An app has
 * already won that fight the moment somebody taps the icon, so the brand takes
 * a compact header and the next gig takes the screen.
 */
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const { user } = useAuth();
  const upcoming = api.gigs.getUpcoming.useQuery();
  const latest = api.homeContent.getHomeLatest.useQuery();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([upcoming.refetch(), latest.refetch()]);
    setRefreshing(false);
  }, [upcoming, latest]);

  const gigs = upcoming.data ?? [];
  const [next, ...rest] = gigs;

  // `getHomeLatest` hands back a featured item plus a list; on a phone that
  // distinction buys nothing, so they collapse into one run of rows.
  const latestItems = [
    ...(latest.data?.featuredItem ? [latest.data.featuredItem] : []),
    ...(latest.data?.items ?? []),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Pinned, like the site's `sticky top-0` nav: the wordmark is the app's
          one piece of permanent furniture, so it does not scroll away. */}
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        {/* The same wordmark the site's nav uses, not a typeset approximation. */}
        <Image
          source={require("../../assets/atmos-wordmark.png")}
          style={styles.wordmark}
          contentFit="contain"
          accessibilityLabel="Atmos"
        />
        <Link href={user ? "/(tabs)/more" : "/(auth)/sign-in"} asChild>
          <Pressable hitSlop={12}>
            <View style={styles.avatar}>
              {user?.name ? (
                <Text style={styles.avatarLabel}>
                  {user.name.slice(0, 1).toUpperCase()}
                </Text>
              ) : (
                <User color={colors.textSoft} size={16} strokeWidth={2} />
              )}
            </View>
          </Pressable>
        </Link>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{
          paddingTop: space.lg,
          paddingBottom: space.xxl,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.textFaint}
          />
        }
      >
        {upcoming.isPending ? (
          <Loading label="Loading gigs" />
        ) : upcoming.isError ? (
          <View style={{ paddingHorizontal: space.lg }}>
            <Notice
              title="Couldn't load gigs"
              detail="Check your connection and pull down to try again."
            />
          </View>
        ) : next ? (
          <View style={{ paddingHorizontal: space.lg }}>
            <NextGigCard gig={next} />
          </View>
        ) : (
          <View style={{ paddingHorizontal: space.lg }}>
            <Notice
              title="Nothing announced yet"
              detail="New dates land here first."
            />
          </View>
        )}

        {rest.length > 0 && (
          <View style={{ marginTop: space.xxl }}>
            <SectionHeader label="Upcoming" href="/(tabs)/gigs" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rail}
            >
              {rest.map((gig) => (
                <GigTile key={gig.id} gig={gig} />
              ))}
            </ScrollView>
          </View>
        )}

        {latestItems.length > 0 && (
          <View style={{ marginTop: space.xxl }}>
            <SectionHeader label="Latest" />
            <View style={{ paddingHorizontal: space.lg, gap: space.md }}>
              {latestItems.map((item) => (
                <ContentRow key={item.id} item={item} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function SectionHeader({ label, href }: { label: string; href?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Eyebrow>{label}</Eyebrow>
      {href ? (
        <Link href={href as never} asChild>
          <Pressable hitSlop={8} style={styles.sectionLink}>
            <Caption style={styles.sectionLinkLabel}>All</Caption>
            <ChevronRight color={colors.textSoft} size={14} strokeWidth={2.5} />
          </Pressable>
        </Link>
      ) : null}
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
    // Opaque, so content scrolling underneath is cut off cleanly rather than
    // bleeding through, and a hard rule to match the door header's edge.
    backgroundColor: colors.bg,
    borderBottomWidth: stroke.hard,
    borderBottomColor: colors.border,
  },
  // 5001x1120 in the source file — the ratio is pinned so the mark never
  // stretches, and the width is the site nav's 8rem.
  wordmark: { width: 128, aspectRatio: 5001 / 1120 },
  avatar: {
    width: 32,
    height: 32,
    borderWidth: stroke.hard,
    borderColor: colors.borderHard,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLabel: { color: colors.textSoft, fontSize: 13, fontWeight: "900" },
  sectionLink: { flexDirection: "row", alignItems: "center", gap: 2 },
  sectionLinkLabel: {
    color: colors.textSoft,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    marginBottom: space.md,
  },
  rail: { paddingHorizontal: space.lg, gap: space.md },
});
