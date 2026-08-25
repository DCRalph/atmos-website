import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { ArrowLeft, Calendar, Clock, MapPin } from "lucide-react-native";

import { api, type RouterOutputs } from "@/lib/api";
import { colors, radius, space, stroke } from "@/lib/theme";
import { formatGigDateLong, formatGigTime } from "@/lib/dates";
import { isTba } from "@/lib/gig";
import { Body, Button, Caption, Eyebrow, Loading, Notice, Pill } from "@/components/ui";
import { LexicalContent, hasLexicalContent } from "@/components/lexical-content";
import { LineUpAvatars } from "@/components/gig/line-up";
import { MediaGallery } from "@/components/gig/media-gallery";

type GigEvent = NonNullable<RouterOutputs["ticketEvents"]["forGig"]>;

/**
 * One gig, laid out like the website's.
 *
 * The web page opens on a full-height hero: the poster blurred out to the
 * edges behind itself, a black fade pulling it into the page, and the title,
 * meta line and line-up avatars over the bottom. This is that hero at phone
 * size — minus the scroll parallax, which buys little at 6 inches and costs
 * a re-render per frame.
 *
 * Below the fold it carries the same content the web page does: the Lexical
 * description, the ticket tiers, and on a past gig the photo gallery. Tickets
 * still check out through the `(checkout)` modal — the hold and release logic
 * lives there and exists once.
 */
export default function GigScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { height: screenHeight } = useWindowDimensions();

  /**
   * A universal link opens this screen with nothing behind it, so `back()`
   * alone would be a dead button. See the associated-domains route on the site.
   */
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/gigs");
  };

  const gig = api.gigs.getById.useQuery({ id }, { enabled: !!id });
  const event = api.ticketEvents.forGig.useQuery(
    { gigId: id },
    { enabled: !!id },
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
  const poster = data.posterFileUpload?.url ?? null;
  const soldByUs = event.data;
  const tba = isTba(data);
  const upcoming =
    (data.gigEndTime ?? data.gigStartTime).getTime() >= Date.now();
  const heroHeight = Math.round(screenHeight * (tba ? 0.9 : 0.6));
  const photos = data.media?.filter((item) => item.type === "photo") ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}
      >
        {/* ---- Hero ---- */}
        <View style={{ height: heroHeight, overflow: "hidden" }}>
          {poster ? (
            // The poster, twice: blurred and overscanned as the backdrop, then
            // sharp and contained over it — the web hero's construction.
            <>
              <Image
                source={{ uri: poster }}
                style={styles.heroBackdrop}
                contentFit="cover"
                blurRadius={30}
                transition={200}
              />
              <Image
                source={{ uri: poster }}
                style={[
                  styles.heroPoster,
                  {
                    top: insets.top + space.sm,
                    bottom: tba ? heroHeight * 0.3 : 148,
                  },
                ]}
                contentFit="contain"
                blurRadius={tba ? 18 : 0}
                transition={200}
              />
            </>
          ) : (
            <View
              style={[styles.heroBackdrop, { backgroundColor: colors.surface }]}
            />
          )}

          <Fade />

          <View style={[styles.heroBody, tba && { bottom: space.xxl }]}>
            {tba ? (
              <>
                <Text style={styles.tbaTitle}>TBA...</Text>
                <Body soft style={{ marginTop: space.sm }}>
                  Something is coming. Turn on notifications and hear it first.
                </Body>
                <Button
                  variant="outline"
                  style={{ marginTop: space.lg }}
                  onPress={() => router.push("/settings/notifications")}
                >
                  Notify me
                </Button>
              </>
            ) : (
              <>
                <Text style={styles.heroTitle}>{data.title}</Text>
                {data.subtitle ? (
                  <Body soft style={{ marginTop: space.xs }}>
                    {data.subtitle}
                  </Body>
                ) : null}

                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Calendar
                      color={colors.textFaint}
                      size={12}
                      strokeWidth={2.5}
                    />
                    <Text style={styles.metaText}>
                      {formatGigDateLong(data.gigStartTime)}
                    </Text>
                  </View>
                  {upcoming ? (
                    <View style={styles.metaItem}>
                      <Clock
                        color={colors.textFaint}
                        size={12}
                        strokeWidth={2.5}
                      />
                      <Text style={styles.metaText}>
                        {data.gigEndTime
                          ? `${formatGigTime(data.gigStartTime)} – ${formatGigTime(data.gigEndTime)}`
                          : `Starts ${formatGigTime(data.gigStartTime)}`}
                      </Text>
                    </View>
                  ) : null}
                  {data.lineUp.length > 0 ? (
                    <LineUpAvatars lineUp={data.lineUp} />
                  ) : null}
                </View>

                {(soldByUs?.venueName ?? null) ? (
                  <View style={[styles.metaItem, { marginTop: space.sm }]}>
                    <MapPin
                      color={colors.textFaint}
                      size={12}
                      strokeWidth={2.5}
                    />
                    <Text style={styles.metaText}>
                      {[soldByUs!.venueName, soldByUs!.venueAddress]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.tagRow}>
                  {soldByUs?.doorsAt ? (
                    <Pill>Doors {formatGigTime(soldByUs.doorsAt)}</Pill>
                  ) : null}
                  {soldByUs?.isR18 ? <Pill tone="warn">R18</Pill> : null}
                  {data.gigTags?.map((relation) => (
                    <Tag key={relation.gigTag.id} tag={relation.gigTag} />
                  ))}
                </View>
              </>
            )}
          </View>

          <View style={[styles.heroNav, { top: insets.top + space.xs }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={goBack}
              hitSlop={10}
              style={styles.backBtn}
            >
              <ArrowLeft color={colors.text} size={18} strokeWidth={2.5} />
            </Pressable>
          </View>
        </View>

        {/* ---- Content ---- */}
        {tba ? null : (
          <View style={styles.content}>
            {upcoming ? (
              <TicketCta
                event={soldByUs ?? null}
                eventPending={event.isPending}
                fallbackLink={data.ticketLink}
                onBuy={(slug) =>
                  router.push({
                    pathname: "/(checkout)/[slug]/tiers",
                    params: { slug },
                  })
                }
              />
            ) : null}

            {hasLexicalContent(data.descriptionLexical) ? (
              <LexicalContent value={data.descriptionLexical} />
            ) : data.shortDescription ? (
              <Body soft style={{ lineHeight: 22 }}>
                {data.shortDescription}
              </Body>
            ) : null}

            {upcoming && soldByUs && soldByUs.status !== "CANCELLED" ? (
              <TierPanel
                event={soldByUs}
                onBuy={() =>
                  router.push({
                    pathname: "/(checkout)/[slug]/tiers",
                    params: { slug: soldByUs.slug },
                  })
                }
              />
            ) : null}

            {!upcoming && photos.length > 0 ? (
              <MediaGallery media={photos} />
            ) : null}

            {!upcoming && photos.length === 0 ? (
              <Caption>This one&apos;s been and gone.</Caption>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/**
 * The web's `GigTicketCta`, state for state: from-price, free, sold out,
 * cancelled, the external-link fallback, and nothing at all.
 */
function TicketCta({
  event,
  eventPending,
  fallbackLink,
  onBuy,
}: {
  event: GigEvent | null;
  eventPending: boolean;
  fallbackLink: string | null;
  onBuy: (slug: string) => void;
}) {
  if (eventPending) return null;

  if (event) {
    if (event.status === "CANCELLED") {
      return (
        <View style={[styles.ctaDead, { borderColor: colors.deny }]}>
          <Text style={[styles.ctaDeadLabel, { color: colors.deny }]}>
            Cancelled
          </Text>
        </View>
      );
    }
    if (event.status === "SOLD_OUT") {
      return (
        <View style={styles.ctaDead}>
          <Text style={styles.ctaDeadLabel}>Sold out</Text>
        </View>
      );
    }
    return (
      <Button onPress={() => onBuy(event.slug)}>
        {event.fromPriceCents === 0
          ? "Free tickets"
          : event.fromPriceCents !== null
            ? `Tickets from ${money(event.fromPriceCents)}`
            : "Get tickets"}
      </Button>
    );
  }

  if (fallbackLink) {
    return (
      <Button
        variant="outline"
        onPress={() =>
          void WebBrowser.openBrowserAsync(fallbackLink, {
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
            controlsColor: colors.text,
            toolbarColor: colors.bg,
          })
        }
      >
        Tickets
      </Button>
    );
  }

  return <Caption>Tickets aren&apos;t on sale for this one.</Caption>;
}

/**
 * The tiers, inline — the web page's buy panel.
 *
 * Read-only rows on purpose: quantities, the hold countdown and release-on-
 * abandon live in the checkout modal and should exist exactly once. This
 * panel is the part of that screen worth having early — what exists, what it
 * costs, what is nearly gone — and every row is a way in.
 */
function TierPanel({
  event,
  onBuy,
}: {
  event: GigEvent;
  onBuy: () => void;
}) {
  if (event.tiers.length === 0) return null;

  return (
    <View style={{ gap: space.sm }}>
      <Eyebrow>Tickets</Eyebrow>
      {event.tiers.map((tier) => (
        <Pressable
          key={tier.id}
          accessibilityRole="button"
          onPress={onBuy}
          style={({ pressed }) => [styles.tier, pressed && { opacity: 0.8 }]}
        >
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Body style={{ fontWeight: "700" }}>{tier.name}</Body>
            {tier.description ? (
              <Caption numberOfLines={2}>{tier.description}</Caption>
            ) : null}
          </View>
          <View style={{ alignItems: "flex-end", gap: 4 }}>
            <Body style={{ fontWeight: "700" }}>
              {tier.isFree ? "Free" : money(tier.priceCents)}
            </Body>
            {!tier.available ? (
              <Pill tone="deny">{tier.unavailableReason ?? "Unavailable"}</Pill>
            ) : tier.lowStock ? (
              <Pill tone="warn">{tier.remainingIfLow} left</Pill>
            ) : null}
          </View>
        </Pressable>
      ))}
      <Button onPress={onBuy}>Get tickets</Button>
    </View>
  );
}

/** A gig tag in its own colour, as the web draws them. */
function Tag({ tag }: { tag: { name: string; color: string } }) {
  return (
    <View
      style={[
        styles.tag,
        { borderColor: tag.color, backgroundColor: `${tag.color}20` },
      ]}
    >
      <Text style={styles.tagLabel}>{tag.name}</Text>
    </View>
  );
}

/** The black fade that pulls the artwork into the page. */
function Fade() {
  return (
    <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
      <Defs>
        <SvgLinearGradient id="heroFade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000" stopOpacity="0.35" />
          <Stop offset="0.35" stopColor="#000" stopOpacity="0.05" />
          <Stop offset="0.62" stopColor="#000" stopOpacity="0.55" />
          <Stop offset="0.94" stopColor="#000" stopOpacity="1" />
        </SvgLinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroFade)" />
    </Svg>
  );
}

/** "$35", or "$35.50" only when the cents are real. */
function money(cents: number): string {
  return cents % 100 === 0
    ? `$${cents / 100}`
    : `$${(cents / 100).toFixed(2)}`;
}

const styles = StyleSheet.create({
  heroBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    transform: [{ scale: 1.15 }],
    opacity: 0.85,
  },
  heroPoster: {
    position: "absolute",
    left: space.xl + space.md,
    right: space.xl + space.md,
  },
  heroBody: {
    position: "absolute",
    left: space.lg,
    right: space.lg,
    bottom: space.md,
  },
  heroNav: { position: "absolute", left: space.md },
  backBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.25)",
  },
  heroTitle: {
    color: colors.text,
    fontSize: 34,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -1,
    textTransform: "uppercase",
  },
  tbaTitle: {
    color: colors.text,
    fontSize: 52,
    fontWeight: "900",
    letterSpacing: -1.5,
    textTransform: "uppercase",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    columnGap: space.md,
    rowGap: space.sm,
    marginTop: space.md,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { color: colors.textSoft, fontSize: 11.5 },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
    marginTop: space.md,
  },
  tag: {
    borderWidth: stroke.hard,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagLabel: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  content: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    gap: space.lg,
  },
  ctaDead: {
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: stroke.hard,
    borderColor: colors.borderHard,
    opacity: 0.65,
    borderRadius: radius.md,
  },
  ctaDeadLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  tier: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    backgroundColor: colors.surface,
    borderWidth: stroke.hair,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
});
