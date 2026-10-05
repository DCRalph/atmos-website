import { useCallback, useState } from "react";
import {
  Animated,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Search, X } from "lucide-react-native";

import { api } from "@/lib/api";
import { colors, radius, space, type } from "@/lib/theme";
import { Button, Loading, Notice } from "@/components/ui";
import { PosterGrid, type GigCardData } from "@/components/gig-card";
import {
  LargeTitle,
  PinnedHeader,
  useScrollHeader,
} from "@/components/screen-header";
import { useTabBarSpace } from "@/components/tab-bar";

/** Matches a search against a gig's name and venue line, ignoring case. */
const matches = (gig: GigCardData, query: string) => {
  const q = query.trim().toLowerCase();
  return !q || `${gig.title} ${gig.subtitle}`.toLowerCase().includes(q);
};

/**
 * Every gig as a poster grid, a month at a time, with search over the top.
 * Past gigs are a second shelf behind the same pills the site uses.
 */
export default function GigsScreen() {
  const tabSpace = useTabBarSpace();
  const { scrollY, scrollProps } = useScrollHeader();
  const [shelf, setShelf] = useState<"upcoming" | "past">("upcoming");
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const upcoming = api.gigs.getUpcoming.useQuery();
  const past = api.gigs.getPast.useQuery(
    { limit: 40 },
    { enabled: shelf === "past" },
  );
  const list = shelf === "upcoming" ? upcoming : past;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await list.refetch();
    setRefreshing(false);
  }, [list]);

  const gigs = (list.data ?? []).filter((gig) => matches(gig, query));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Animated.ScrollView
        {...scrollProps}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: tabSpace }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.textFaint}
          />
        }
      >
        <LargeTitle>Gigs</LargeTitle>

        <View style={styles.controls}>
          <View style={styles.search}>
            <Search color={colors.textFaint} size={16} strokeWidth={2} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search gigs and venues"
              placeholderTextColor={colors.textFaint}
              autoCorrect={false}
              returnKeyType="search"
              clearButtonMode="never"
              style={styles.searchInput}
            />
            {query ? (
              <Pressable
                accessibilityLabel="Clear search"
                hitSlop={10}
                onPress={() => setQuery("")}
              >
                <X color={colors.textSoft} size={16} strokeWidth={2} />
              </Pressable>
            ) : null}
          </View>
          <View style={styles.shelves}>
            <Button
              size="sm"
              variant={shelf === "upcoming" ? "primary" : "outline"}
              onPress={() => setShelf("upcoming")}
            >
              Upcoming
            </Button>
            <Button
              size="sm"
              variant={shelf === "past" ? "primary" : "outline"}
              onPress={() => setShelf("past")}
            >
              Past
            </Button>
          </View>
        </View>

        <View style={styles.body}>
          {list.isPending ? (
            <Loading />
          ) : list.isError ? (
            <Notice
              title="Couldn't load gigs"
              detail="Check your connection and pull down to try again."
            />
          ) : gigs.length > 0 ? (
            <PosterGrid gigs={gigs} />
          ) : query ? (
            <Notice
              title="No matches"
              detail={`Nothing ${shelf} matches "${query.trim()}".`}
            />
          ) : (
            <Notice
              title={
                shelf === "upcoming" ? "Nothing coming up" : "Nothing here yet"
              }
              detail={
                shelf === "upcoming" ? "New dates land here first." : undefined
              }
            />
          )}
        </View>
      </Animated.ScrollView>

      <PinnedHeader scrollY={scrollY} title="Gigs" />
    </View>
  );
}

const styles = StyleSheet.create({
  controls: {
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    gap: space.md,
  },
  // The site's pill input.
  search: {
    height: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  searchInput: {
    ...type.body,
    flex: 1,
    color: colors.text,
    paddingVertical: 0,
  },
  shelves: { flexDirection: "row", gap: space.sm },
  body: { paddingHorizontal: space.lg, paddingTop: space.xl },
});
