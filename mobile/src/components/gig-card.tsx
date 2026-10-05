import { Link } from "expo-router";
import { format } from "date-fns";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { ArrowRight } from "lucide-react-native";

import { colors, space, type } from "@/lib/theme";
import { gigWhen, groupByMonth } from "@/lib/gig";
import { formatGigTime } from "@/lib/dates";
import { Display, Eyebrow } from "@/components/ui";
import { MonthBadge, POSTER_RATIO, Poster } from "@/components/poster";

export type GigCardData = {
  id: string;
  title: string;
  subtitle: string;
  gigStartTime: Date;
  /** The date is a placeholder — see `@/lib/gig`. */
  isTba: boolean;
  posterFileUpload?: { url: string } | null;
};

/** One month's heading: the accent badge and the month's name. */
function MonthHeader({ month }: { month: Date | null }) {
  return (
    <View style={styles.monthHeader}>
      {month ? (
        <MonthBadge month={format(month, "MMM")} year={format(month, "yyyy")} />
      ) : (
        <MonthBadge />
      )}
      <Display size={20}>
        {month ? format(month, "MMMM") : "To be announced"}
      </Display>
    </View>
  );
}

/** Month-grouped rows, the site's upcoming list. */
export function GigRows({ gigs }: { gigs: readonly GigCardData[] }) {
  return (
    <View style={{ gap: space.xxl }}>
      {groupByMonth(gigs).map(({ key, month, gigs }) => (
        <View key={key}>
          <MonthHeader month={month} />
          {gigs.map((gig) => (
            <GigRow key={gig.id} gig={gig} />
          ))}
        </View>
      ))}
    </View>
  );
}

/** Poster, name and when, with a round arrow. */
export function GigRow({ gig }: { gig: GigCardData }) {
  return (
    <Link href={`/gigs/${gig.id}`} asChild>
      {/* Styling lives on the inner View, never on a `style` function here:
          `Link asChild` renders through a Slot that merges style by object
          spread, and spreading a function yields `{}`. */}
      <Pressable>
        {({ pressed }) => (
          <View style={[styles.row, pressed && { opacity: 0.7 }]}>
            <Poster
              uri={gig.posterFileUpload?.url}
              tba={gig.isTba}
              tbaSize={10}
              style={styles.rowPoster}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Display size={17} keepCase numberOfLines={2}>
                {gig.isTba ? "TBA" : gig.title}
              </Display>
              <Text numberOfLines={1} style={styles.meta}>
                {gig.isTba
                  ? "Date to be announced"
                  : [
                      gigWhen(gig),
                      formatGigTime(gig.gigStartTime),
                      gig.subtitle,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
              </Text>
            </View>
            <View style={styles.arrow}>
              <ArrowRight color={colors.textSoft} size={16} strokeWidth={2} />
            </View>
          </View>
        )}
      </Pressable>
    </Link>
  );
}

/** Month-grouped two-up poster grid, for a screen with `space.lg` gutters. */
export function PosterGrid({ gigs }: { gigs: readonly GigCardData[] }) {
  const { width } = useWindowDimensions();
  const tileWidth = (width - space.lg * 2 - space.md) / 2;
  return (
    <View style={{ gap: space.xxl }}>
      {groupByMonth(gigs).map(({ key, month, gigs }) => (
        <View key={key}>
          <MonthHeader month={month} />
          <View style={styles.grid}>
            {gigs.map((gig) => (
              <PosterTile key={gig.id} gig={gig} width={tileWidth} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Grid tile: poster, then the name and date under it. */
export function PosterTile({
  gig,
  width,
}: {
  gig: GigCardData;
  width: number;
}) {
  return (
    <Link href={`/gigs/${gig.id}`} asChild>
      <Pressable style={{ width }}>
        {({ pressed }) => (
          <View style={pressed && { opacity: 0.7 }}>
            <Poster
              uri={gig.posterFileUpload?.url}
              tba={gig.isTba}
              tbaSize={22}
              style={{ width: "100%", aspectRatio: POSTER_RATIO }}
            />
            <Display
              size={14}
              keepCase
              numberOfLines={2}
              style={{ marginTop: space.md }}
            >
              {gig.isTba ? "TBA" : gig.title}
            </Display>
            <Eyebrow style={{ marginTop: 6 }}>
              {[gigWhen(gig), gig.isTba ? null : gig.subtitle]
                .filter(Boolean)
                .join(" · ")}
            </Eyebrow>
          </View>
        )}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
    marginBottom: space.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    paddingBottom: space.lg,
    marginBottom: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowPoster: { width: 60, aspectRatio: POSTER_RATIO },
  meta: { ...type.caption, color: colors.textSoft, marginTop: 6 },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: space.md,
    rowGap: space.xl,
  },
});
