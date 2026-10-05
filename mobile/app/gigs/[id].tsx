import type { ReactNode } from "react";
import * as WebBrowser from "expo-web-browser";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Animated,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  ArrowUpRight,
  Clock,
  MapPin,
  Share2,
} from "lucide-react-native";

import { api, type RouterOutputs } from "@/lib/api";
import { API_URL } from "@/lib/env";
import { colors, concentric, radius, space, type } from "@/lib/theme";
import { formatGigDateLong, formatGigTime } from "@/lib/dates";
import { gigPath } from "~/lib/gig-url";
import { formatNZDCompact } from "~/lib/ticketing/money";
import {
  Body,
  Button,
  Caption,
  Display,
  Eyebrow,
  Heading,
  IconButton,
  Loading,
  Notice,
} from "@/components/ui";
import { Glass } from "@/components/glass";
import { POSTER_RATIO, Poster, Scrim } from "@/components/poster";
import {
  BottomFade,
  HEADER_HEIGHT,
  HEADER_TAIL,
  PinnedHeader,
  useScrollHeader,
} from "@/components/screen-header";
import {
  LexicalContent,
  hasLexicalContent,
} from "@/components/lexical-content";
import { LineUpAvatars } from "@/components/gig/line-up";
import { MediaGallery } from "@/components/gig/media-gallery";

type GigEvent = NonNullable<RouterOutputs["ticketEvents"]["forGig"]>;

/** Gap between the buy panel and the screen's edges. */
const PANEL_INSET = 12;
/** How far the body's text rides up over the bottom of the poster. */
const BODY_OVERLAP = space.xxl;

/**
 * One gig, laid out like the website's.
 *
 * The poster opens the page edge to edge, with round glass back and share
 * buttons over it that never scroll away; once the poster has gone under the
 * top, a black bar with the gig's name fills in behind them. Below: when and
 * where, the bill, the description, and on a past gig the photos. Tickets
 * sit in a floating glass panel whose corners run concentric with the
 * display's, and check out through the `(checkout)` modal, where the hold
 * and release logic lives once.
 */
export default function GigScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { scrollY, scrollProps } = useScrollHeader();

  /**
   * A universal link opens this screen with nothing behind it, so `back()`
   * alone would be a dead button. See the associated-domains route on the site.
   */
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/gigs");
  };

  const gig = api.gigs.getById.useQuery({ id }, { enabled: !!id });
  // The URL may carry a title slug instead of the cuid (the website's pretty
  // links, see src/lib/gig-url.ts), so the ticket lookup waits for the real
  // id to come back with the gig.
  const gigDbId = gig.data?.id;
  const event = api.ticketEvents.forGig.useQuery(
    { gigId: gigDbId ?? "" },
    { enabled: !!gigDbId },
  );

  if (gig.isPending) return <Loading label="Loading gig" />;

  if (!gig.data) {
    return (
      <View style={{ flex: 1, padding: space.lg, justifyContent: "center" }}>
        <Notice
          title="Gig not found"
          detail="It may have been taken down."
          action={<Button onPress={goBack}>Back</Button>}
        />
      </View>
    );
  }

  const data = gig.data;
  const soldByUs = event.data;
  const tba = data.isTba;
  const upcoming =
    (data.gigEndTime ?? data.gigStartTime).getTime() >= Date.now();
  const posterHeight = width / POSTER_RATIO;
  const photos = data.media?.filter((item) => item.type === "photo") ?? [];
  const venue = soldByUs?.venueName ?? data.subtitle;
  const showPanel = upcoming && !tba && !event.isPending;
  // The body's text starts `BODY_OVERLAP` up into the poster; the bar must be
  // solid before that reaches its faded edge.
  const solidAt =
    posterHeight - BODY_OVERLAP - (insets.top + HEADER_HEIGHT + HEADER_TAIL);

  const share = () =>
    void Share.share({
      url: `${API_URL}${gigPath(data)}`,
      message: data.title,
    });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Animated.ScrollView
        {...scrollProps}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: (showPanel ? 120 : space.xxl) + insets.bottom,
        }}
      >
        <View style={{ height: posterHeight }}>
          <Poster
            uri={data.posterFileUpload?.url}
            tba={tba}
            tbaSize={56}
            style={StyleSheet.absoluteFill}
          />
          <Scrim from={0.6} />
        </View>

        <View style={styles.body}>
          {tba ? (
            <>
              <Heading size={48}>TBA</Heading>
              <Body soft style={{ marginTop: space.md }}>
                Something is coming. Turn on notifications and hear it first.
              </Body>
              <Button
                variant="outline"
                style={{ marginTop: space.xl, alignSelf: "flex-start" }}
                onPress={() => router.push("/settings/notifications")}
              >
                Notify me
              </Button>
            </>
          ) : (
            <>
              <Eyebrow style={{ color: colors.textSoft }}>
                {formatGigDateLong(data.gigStartTime)}
              </Eyebrow>
              <Display size={32} keepCase style={{ marginTop: space.md }}>
                {data.title}
              </Display>

              <View style={styles.meta}>
                {upcoming ? (
                  <MetaItem icon={Clock}>
                    {data.gigEndTime
                      ? `${formatGigTime(data.gigStartTime)} to ${formatGigTime(data.gigEndTime)}`
                      : `Starts ${formatGigTime(data.gigStartTime)}`}
                  </MetaItem>
                ) : null}
                {venue ? <MetaItem icon={MapPin}>{venue}</MetaItem> : null}
              </View>

              <View style={styles.tags}>
                {soldByUs?.doorsAt ? (
                  <Chip>Doors {formatGigTime(soldByUs.doorsAt)}</Chip>
                ) : null}
                {soldByUs?.isR18 ? <Chip dot={colors.warn}>R18</Chip> : null}
                {data.gigTags?.map(({ gigTag }) => (
                  <Chip key={gigTag.id} dot={gigTag.color}>
                    {gigTag.name}
                  </Chip>
                ))}
              </View>

              {data.lineUp.length > 0 ? (
                <Section title="Line up">
                  <LineUpAvatars lineUp={data.lineUp} rows />
                </Section>
              ) : null}

              {hasLexicalContent(data.descriptionLexical) ? (
                <Section title="About">
                  <LexicalContent value={data.descriptionLexical} />
                </Section>
              ) : data.shortDescription ? (
                <Section title="About">
                  <Body soft style={{ lineHeight: 23 }}>
                    {data.shortDescription}
                  </Body>
                </Section>
              ) : null}

              {!upcoming && photos.length > 0 ? (
                <Section title="Photos">
                  <MediaGallery media={photos} />
                </Section>
              ) : null}
              {!upcoming && photos.length === 0 ? (
                <Caption style={{ marginTop: space.xxl }}>
                  This one&apos;s been and gone.
                </Caption>
              ) : null}
            </>
          )}
        </View>
      </Animated.ScrollView>

      <PinnedHeader
        scrollY={scrollY}
        shade
        solidAt={solidAt}
        // The bar names the gig once the page's own title has gone under it.
        titleAt={solidAt + 120}
        title={tba ? "TBA" : data.title}
        left={<IconButton label="Back" icon={ArrowLeft} onPress={goBack} />}
        right={
          tba ? null : (
            <IconButton label="Share" icon={Share2} onPress={share} />
          )
        }
      />

      {showPanel ? <BottomFade height={insets.bottom + 140} /> : null}
      {showPanel ? (
        <BuyPanel
          event={soldByUs ?? null}
          fallbackLink={data.ticketLink}
          onBuy={(slug) =>
            router.push({
              pathname: "/(checkout)/[slug]/tiers",
              params: { slug },
            })
          }
        />
      ) : null}
    </View>
  );
}

function MetaItem({
  icon: Icon,
  children,
}: {
  icon: typeof Clock;
  children: string;
}) {
  return (
    <View style={styles.metaItem}>
      <Icon color={colors.textFaint} size={14} strokeWidth={2} />
      <Text style={styles.metaLabel}>{children}</Text>
    </View>
  );
}

/** A tag in the site's chip shape, its colour as a dot. */
function Chip({ children, dot }: { children: ReactNode; dot?: string }) {
  return (
    <View style={styles.chip}>
      {dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
      <Text style={styles.chipLabel}>{children}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ marginTop: space.xxl + space.md }}>
      <Heading size={24} style={{ marginBottom: space.md }}>
        {title}
      </Heading>
      {children}
    </View>
  );
}

/**
 * The web's `GigTicketCta`, state for state: from-price, free, sold out,
 * cancelled, the external-link fallback, and nothing at all. Floating glass,
 * with corners concentric to the display's.
 */
function BuyPanel({
  event,
  fallbackLink,
  onBuy,
}: {
  event: GigEvent | null;
  fallbackLink: string | null;
  onBuy: (slug: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const bottom = insets.bottom > 0 ? PANEL_INSET : space.lg;

  let price: string | null = null;
  let note = "Tickets";
  let action: ReactNode = null;

  if (event) {
    if (event.status === "CANCELLED") {
      note = "Cancelled";
    } else if (event.status === "SOLD_OUT") {
      note = "Sold out";
    } else {
      note = event.fromPriceCents === 0 ? "Entry" : "Tickets from";
      price =
        event.fromPriceCents === 0
          ? "Free"
          : event.fromPriceCents !== null
            ? formatNZDCompact(event.fromPriceCents)
            : null;
      action = (
        <Button variant="accent" size="lg" onPress={() => onBuy(event.slug)}>
          Get tickets
        </Button>
      );
    }
  } else if (fallbackLink) {
    // Sold somewhere else: the arrow says the button leaves the app.
    note = "On sale";
    action = (
      <Button
        variant="primary"
        size="lg"
        icon={ArrowUpRight}
        onPress={() =>
          void WebBrowser.openBrowserAsync(fallbackLink, {
            presentationStyle:
              WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
            controlsColor: colors.text,
            toolbarColor: colors.bg,
          })
        }
      >
        Get tickets
      </Button>
    );
  } else {
    return null;
  }

  return (
    <Glass
      dark
      style={[
        styles.panel,
        {
          left: PANEL_INSET,
          right: PANEL_INSET,
          bottom,
          borderRadius: concentric(PANEL_INSET),
        },
      ]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Eyebrow>{note}</Eyebrow>
        {price ? (
          <Display size={26} style={{ marginTop: 6 }}>
            {price}
          </Display>
        ) : null}
      </View>
      {action}
    </Glass>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.lg, marginTop: -BODY_OVERLAP },
  meta: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: space.xl,
    rowGap: space.sm,
    marginTop: space.lg,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaLabel: { ...type.label, fontSize: 11, color: colors.textSoft },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: space.lg },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space.sm,
    paddingVertical: 5,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  chipLabel: { ...type.label, fontSize: 10, color: colors.textSoft },
  panel: {
    position: "absolute",
    // Tall enough that the concentric radius still reads as a rounded
    // rectangle rather than collapsing to a capsule.
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    paddingLeft: space.xl + space.xs,
    paddingRight: space.lg,
    paddingVertical: space.lg,
  },
});
