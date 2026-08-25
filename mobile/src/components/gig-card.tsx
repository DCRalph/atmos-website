import { Image } from "expo-image";
import { Link } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import type { GigMode } from "~Prisma/client";

import { Body, Caption, Pill } from "@/components/ui";
import { colors, radius, space, stroke } from "@/lib/theme";
import { gigWhen, gigWhenLong } from "@/lib/gig";

export type GigCardData = {
  id: string;
  title: string;
  subtitle: string;
  gigStartTime: Date;
  /** `TO_BE_ANNOUNCED` means the date is a placeholder — see `@/lib/gig`. */
  mode: GigMode;
  posterFileUpload?: { url: string } | null;
};

/** The hero card on Home — the next gig, given the room it deserves. */
export function NextGigCard({ gig }: { gig: GigCardData }) {
  return (
    <Link href={`/gigs/${gig.id}`} asChild>
      {/* Styling lives on the inner View, never on a `style` function here:
          `Link asChild` renders through a Slot that merges style by object
          spread, and spreading a function yields `{}` — it would be dropped
          silently. The children render-prop still gives us `pressed`. */}
      <Pressable>
        {({ pressed }) => (
          <View style={[styles.hero, pressed && { opacity: 0.85 }]}>
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
              <Pill tone="in">{gigWhenLong(gig)}</Pill>
              <Body style={styles.heroTitle} numberOfLines={2}>
                {gig.title}
              </Body>
              {gig.subtitle ? (
                <Caption numberOfLines={1}>{gig.subtitle}</Caption>
              ) : null}
            </View>
          </View>
        )}
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
      <Pressable>
        {({ pressed }) => (
          <View
            style={[
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
              <Caption>{gigWhen(gig)}</Caption>
              <Body
                numberOfLines={1}
                style={{ fontWeight: "900", textTransform: "uppercase" }}
              >
                {gig.title}
              </Body>
              {gig.subtitle ? (
                <Caption numberOfLines={1}>{gig.subtitle}</Caption>
              ) : null}
            </View>
          </View>
        )}
      </Pressable>
    </Link>
  );
}

/** Every poster on the site is one box so cards line up in a grid. 4:5 here. */
const POSTER_RATIO = 4 / 5;

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: stroke.hard,
    borderColor: colors.border,
    overflow: "hidden",
  },
  heroImage: { width: "100%", aspectRatio: POSTER_RATIO },
  heroFallback: { backgroundColor: colors.surfaceRaised },
  heroBody: { padding: space.lg, gap: space.sm },
  heroTitle: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.5,
    textTransform: "uppercase",
  },
  tile: {
    width: 190,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: stroke.hair,
    borderColor: colors.border,
    overflow: "hidden",
  },
  tileImage: { width: "100%", aspectRatio: POSTER_RATIO },
});
