import { Image } from "expo-image";
import { Link } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { Body, Caption, Pill } from "@/components/ui";
import { colors, radius, space } from "@/lib/theme";
import { formatGigDate, formatGigTime } from "@/lib/dates";

export type GigCardData = {
  id: string;
  title: string;
  subtitle: string;
  gigStartTime: Date;
  posterFileUpload?: { url: string } | null;
};

/** The hero card on Home — the next gig, given the room it deserves. */
export function NextGigCard({ gig }: { gig: GigCardData }) {
  return (
    <Link href={`/gigs/${gig.id}`} asChild>
      <Pressable style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
        <View style={styles.hero}>
          {gig.posterFileUpload?.url ? (
            <Image
              source={{ uri: gig.posterFileUpload.url }}
              style={styles.heroImage}
              contentFit="cover"
              transition={180}
            />
          ) : (
            <View style={[styles.heroImage, styles.heroFallback]} />
          )}
          <View style={styles.heroBody}>
            <Pill tone="in">
              {formatGigDate(gig.gigStartTime)} · {formatGigTime(gig.gigStartTime)}
            </Pill>
            <Body style={styles.heroTitle} numberOfLines={2}>
              {gig.title}
            </Body>
            {gig.subtitle ? (
              <Caption numberOfLines={1}>{gig.subtitle}</Caption>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

/** Compact card for the horizontal Upcoming rail and the gigs list. */
export function GigTile({
  gig,
  wide,
}: {
  gig: GigCardData;
  wide?: boolean;
}) {
  return (
    <Link href={`/gigs/${gig.id}`} asChild>
      <Pressable
        style={({ pressed }) => [
          styles.tile,
          wide && { width: "100%" },
          pressed && { opacity: 0.85 },
        ]}
      >
        {gig.posterFileUpload?.url ? (
          <Image
            source={{ uri: gig.posterFileUpload.url }}
            style={styles.tileImage}
            contentFit="cover"
            transition={180}
          />
        ) : (
          <View style={[styles.tileImage, styles.heroFallback]} />
        )}
        <View style={{ padding: space.md, gap: 2 }}>
          <Caption>{formatGigDate(gig.gigStartTime)}</Caption>
          <Body numberOfLines={1} style={{ fontWeight: "700" }}>
            {gig.title}
          </Body>
          {gig.subtitle ? (
            <Caption numberOfLines={1}>{gig.subtitle}</Caption>
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  heroImage: { width: "100%", aspectRatio: 1 },
  heroFallback: { backgroundColor: colors.surfaceRaised },
  heroBody: { padding: space.lg, gap: space.sm },
  heroTitle: { fontSize: 21, fontWeight: "800", letterSpacing: -0.4 },
  tile: {
    width: 190,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  tileImage: { width: "100%", aspectRatio: 1 },
});
