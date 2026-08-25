import { useState } from "react";
import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowUpRight, X } from "lucide-react-native";
import { format } from "date-fns";

import { api, type RouterOutputs } from "@/lib/api";
import { API_URL } from "@/lib/env";
import { mediaUrl } from "@/lib/media";
import { formatGigDate, formatGigTime } from "@/lib/dates";
import { colors, space, stroke } from "@/lib/theme";
import { Caption } from "@/components/ui";

/**
 * The bill on a gig page: the overlapping avatar stack and the sheet it opens.
 *
 * A native port of the web's `LineUpAvatars`. Same rules: summaries are
 * fetched with the page rather than on open, so the sheet has nothing to wait
 * for; one sheet serves the whole bill with a switcher, because reading down a
 * line-up should not mean closing and reopening; and the Profile and Instagram
 * actions only render when they lead somewhere.
 */

type LineUpEntry = NonNullable<
  RouterOutputs["gigs"]["getById"]
>["lineUp"][number];
type ArtistSummary = NonNullable<
  RouterOutputs["creatorProfiles"]["publicSummary"]
>;
type SummaryGig = ArtistSummary["gigs"][number];

/** How many posters the "previously" strip shows before it stops. */
const STRIP_LIMIT = 5;

export function LineUpAvatars({
  lineUp,
  size = 28,
}: {
  lineUp: readonly LineUpEntry[];
  size?: number;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  // The batch link folds the whole bill into one request, and five minutes of
  // staleness is nothing for a gig history.
  const summaries = api.useQueries((t) =>
    lineUp.map((entry) =>
      t.creatorProfiles.publicSummary(
        { handle: entry.creatorProfile.handle },
        { staleTime: 5 * 60 * 1000 },
      ),
    ),
  );

  if (lineUp.length === 0) return null;

  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {lineUp.map((entry, i) => (
          <Pressable
            key={entry.id}
            accessibilityRole="button"
            accessibilityLabel={entry.creatorProfile.displayName}
            hitSlop={6}
            onPress={() => {
              setIndex(i);
              setOpen(true);
            }}
            style={{ marginLeft: i === 0 ? 0 : -Math.round(size * 0.3) }}
          >
            <ArtistAvatar
              profile={entry.creatorProfile}
              size={size}
              ringColor="#000"
            />
          </Pressable>
        ))}
      </View>

      <ArtistSheet
        lineUp={lineUp}
        index={index}
        onSelect={setIndex}
        summary={index === null ? undefined : summaries[index]?.data}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

/**
 * `index` outlives `open` on purpose: clearing it on close would empty the
 * sheet mid-dismissal.
 */
function ArtistSheet({
  lineUp,
  index,
  onSelect,
  summary,
  open,
  onClose,
}: {
  lineUp: readonly LineUpEntry[];
  index: number | null;
  onSelect: (index: number) => void;
  summary: ArtistSummary | null | undefined;
  open: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const selected = index === null ? null : lineUp[index];
  if (!selected) return null;

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* The scrim is the dismiss surface; the sheet itself swallows taps. */}
      <Pressable style={styles.scrim} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.sm }]}>
        {lineUp.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.switcher}
          >
            {lineUp.map((entry, i) => (
              <Pressable
                key={entry.id}
                accessibilityRole="button"
                accessibilityLabel={entry.creatorProfile.displayName}
                onPress={() => onSelect(i)}
                style={i === index ? styles.switchOn : { opacity: 0.45 }}
              >
                <ArtistAvatar profile={entry.creatorProfile} size={36} />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.head}>
          <ArtistAvatar profile={selected.creatorProfile} size={48} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={styles.name}>
              {selected.creatorProfile.displayName}
            </Text>
            <Text numberOfLines={1} style={styles.handle}>
              {summary
                ? (metaLine(summary) ?? countLabel(summary.gigs.length))
                : (selected.role ??
                  selected.creatorProfile.tagline ??
                  "Loading")}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={10}>
            <X color={colors.textFaint} size={18} strokeWidth={2.5} />
          </Pressable>
        </View>

        {summary ? (
          <SummaryBody summary={summary} onNavigate={onClose} />
        ) : (
          <View style={[styles.strip, { marginTop: space.sm }]}>
            {Array.from({ length: STRIP_LIMIT }).map((_, i) => (
              <View key={i} style={[styles.poster, styles.posterEmpty]} />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

function SummaryBody({
  summary,
  onNavigate,
}: {
  summary: ArtistSummary;
  onNavigate: () => void;
}) {
  const router = useRouter();
  const now = Date.now();

  const upcoming = summary.gigs
    .filter((gig) => gigEnd(gig) >= now)
    .sort((a, b) => a.gigStartTime.getTime() - b.gigStartTime.getTime());
  const previous = summary.gigs.filter((gig) => gigEnd(gig) < now);

  const next = upcoming[0];
  const strip = previous.slice(0, STRIP_LIMIT);
  const oldest = previous[previous.length - 1];
  const newest = previous[0];

  const openGig = (id: string) => {
    onNavigate();
    router.push({ pathname: "/gigs/[id]", params: { id } });
  };

  return (
    <>
      {next ? (
        <View style={{ marginTop: space.sm }}>
          <SectionRule label="Upcoming" count={upcoming.length} highlight />
          <Pressable
            onPress={() => openGig(next.id)}
            style={({ pressed }) => [styles.next, pressed && { opacity: 0.8 }]}
          >
            <Poster gig={next} width={52} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={styles.nextTitle}>
                {gigTitle(next)}
              </Text>
              <Caption numberOfLines={1}>
                {formatGigDate(next.gigStartTime)} ·{" "}
                {formatGigTime(next.gigStartTime)}
              </Caption>
              {next.role !== null || upcoming.length > 1 ? (
                <Text numberOfLines={1} style={styles.nextRole}>
                  {[
                    next.role,
                    upcoming.length > 1
                      ? `plus ${upcoming.length - 1} more`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              ) : null}
            </View>
          </Pressable>
        </View>
      ) : null}

      {strip.length > 0 && newest && oldest ? (
        <View style={{ marginTop: space.md }}>
          <SectionRule label="Previously" count={previous.length} />
          <View style={styles.strip}>
            {strip.map((gig) => (
              <Pressable
                key={gig.id}
                accessibilityRole="button"
                accessibilityLabel={gigTitle(gig)}
                onPress={() => openGig(gig.id)}
                style={{ flex: 1, minWidth: 0 }}
              >
                <Poster gig={gig} />
              </Pressable>
            ))}
            {/* Keeps a short history poster-sized instead of stretching it. */}
            {Array.from({ length: STRIP_LIMIT - strip.length }).map((_, i) => (
              <View key={i} style={{ flex: 1 }} />
            ))}
          </View>
          <Text style={styles.stripLabel}>
            {monthRange(oldest.gigStartTime, newest.gigStartTime)}
            {previous.length > strip.length ? ` · ${previous.length} gigs` : ""}
          </Text>
        </View>
      ) : null}

      <Actions summary={summary} />
    </>
  );
}

function Actions({ summary }: { summary: ArtistSummary }) {
  const profileUrl = summary.isPublished
    ? `${API_URL}/@${summary.handle}`
    : null;
  if (!profileUrl && !summary.instagramUrl) return null;

  const open = (url: string) =>
    void WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      controlsColor: colors.text,
      toolbarColor: colors.bg,
    });

  return (
    <View style={styles.actions}>
      {profileUrl ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => open(profileUrl)}
          style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.actionLabel}>Profile</Text>
          <ArrowUpRight color={colors.text} size={14} strokeWidth={2.5} />
        </Pressable>
      ) : null}
      {summary.instagramUrl ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => open(summary.instagramUrl!)}
          style={({ pressed }) => [
            styles.action,
            profileUrl && styles.actionDivider,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={[styles.actionLabel, { color: "#ff8fc0" }]}>
            Instagram
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function SectionRule({
  label,
  count,
  highlight,
}: {
  label: string;
  count: number;
  highlight?: boolean;
}) {
  return (
    <View style={styles.sectionRule}>
      {highlight ? <View style={styles.dot} /> : null}
      <Text style={[styles.sectionLabel, highlight && { color: VIOLET }]}>
        {label}
      </Text>
      <View style={styles.rule} />
      <Text style={styles.sectionCount}>{count}</Text>
    </View>
  );
}

/** Sized by the caller, since the same face appears at three scales. */
export function ArtistAvatar({
  profile,
  size,
  ringColor,
}: {
  profile: { displayName: string; avatarFileId: string | null };
  size: number;
  ringColor?: string;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        backgroundColor: colors.surfaceRaised,
        borderWidth: ringColor ? 2 : StyleSheet.hairlineWidth,
        borderColor: ringColor ?? "rgba(255,255,255,0.2)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {profile.avatarFileId ? (
        <Image
          source={{ uri: mediaUrl(profile.avatarFileId) }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          transition={120}
        />
      ) : (
        <Text
          style={{
            color: colors.textSoft,
            fontWeight: "900",
            fontSize: size * 0.38,
          }}
        >
          {profile.displayName.slice(0, 1).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

/** A gig's artwork, or a marked placeholder when it has none. */
function Poster({ gig, width }: { gig: SummaryGig; width?: number }) {
  const isTba = gig.mode === "TO_BE_ANNOUNCED";
  return (
    <View style={[styles.poster, width ? { width, flex: 0 } : null]}>
      {gig.posterFileUploadId ? (
        <Image
          source={{ uri: mediaUrl(gig.posterFileUploadId) }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          blurRadius={isTba ? 12 : 0}
          transition={120}
        />
      ) : (
        <View style={styles.posterEmptyInner}>
          <Text style={styles.posterInitial}>
            {gigTitle(gig).slice(0, 1).toUpperCase()}
          </Text>
        </View>
      )}
    </View>
  );
}

/** A TBA gig keeps its secret here too. */
function gigTitle(gig: SummaryGig): string {
  return gig.mode === "TO_BE_ANNOUNCED" ? "TBA" : gig.title;
}

function gigEnd(gig: SummaryGig): number {
  return (gig.gigEndTime ?? gig.gigStartTime).getTime();
}

function metaLine(summary: ArtistSummary): string | null {
  const parts = [
    summary.isPublished ? `@${summary.handle}` : null,
    summary.tagline,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function countLabel(total: number): string {
  return total === 1 ? "First time with us" : `${total} gigs for Atmos`;
}

function monthRange(from: Date, to: Date): string {
  const start = format(from, "MMM yy");
  const end = format(to, "MMM yy");
  return start === end ? start : `${start} – ${end}`;
}

const VIOLET = "#c4b5fd";

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    backgroundColor: colors.bg,
    borderTopWidth: stroke.hard,
    borderTopColor: colors.borderHard,
    paddingTop: space.md,
  },
  switcher: {
    flexDirection: "row",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },
  switchOn: {
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.text,
    margin: -2,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  name: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.4,
    textTransform: "uppercase",
  },
  handle: {
    color: colors.textFaint,
    fontSize: 11,
    fontFamily: "Menlo",
    marginTop: 2,
  },
  sectionRule: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    marginBottom: space.sm,
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: VIOLET },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.textFaint,
  },
  rule: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.12)" },
  sectionCount: { color: colors.textFaint, fontSize: 11, fontFamily: "Menlo" },
  next: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginHorizontal: space.lg,
    padding: space.sm,
    backgroundColor: "rgba(71,0,130,0.35)",
  },
  nextTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  nextRole: {
    color: VIOLET,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginTop: 3,
  },
  strip: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: space.lg,
  },
  poster: {
    width: "100%",
    aspectRatio: 3 / 4,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: colors.surface,
  },
  posterEmpty: { borderColor: colors.border },
  posterEmptyInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  posterInitial: { color: colors.textFaint, fontWeight: "900", fontSize: 13 },
  stripLabel: {
    color: colors.textFaint,
    fontSize: 10.5,
    fontFamily: "Menlo",
    marginTop: space.sm,
    paddingHorizontal: space.lg,
  },
  actions: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.15)",
    marginTop: space.lg,
  },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: space.md + 2,
  },
  actionDivider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: "rgba(255,255,255,0.15)",
  },
  actionLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
});
