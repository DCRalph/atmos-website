import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";

import { api } from "@/lib/api";
import { colors, radius, space, stroke } from "@/lib/theme";
import { formatGigDateLong, formatGigTime } from "@/lib/dates";
import {
  Body,
  Button,
  Caption,
  Eyebrow,
  Loading,
  Notice,
  Pill,
  Title,
} from "@/components/ui";

/**
 * One gig.
 *
 * If the gig has a ticketed event of ours, the buy button goes into the app's
 * own checkout. If it only has an external `ticketLink`, that opens in a
 * browser — pretending to own somebody else's checkout would be worse than
 * handing it over cleanly.
 */
export default function GigScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();

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
          action={<Button onPress={() => router.back()}>Back</Button>}
        />
      </View>
    );
  }

  const data = gig.data;
  const poster = data.posterFileUpload?.url ?? null;
  const soldByUs = event.data;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingBottom: space.xxl }}
    >
      {poster ? (
        <Image
          source={{ uri: poster }}
          style={styles.poster}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={[styles.poster, { backgroundColor: colors.surfaceRaised }]} />
      )}

      <Pressable
        onPress={() => router.back()}
        hitSlop={16}
        style={[styles.back, { top: insets.top + space.sm }]}
      >
        <ArrowLeft color={colors.text} size={20} strokeWidth={2.5} />
      </Pressable>

      <View style={{ padding: space.lg, gap: space.md }}>
        <View style={{ gap: 4 }}>
          <Eyebrow>{formatGigDateLong(data.gigStartTime)}</Eyebrow>
          <Title>{data.title}</Title>
          {data.subtitle ? <Body soft>{data.subtitle}</Body> : null}
        </View>

        <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
          <Pill>{formatGigTime(data.gigStartTime)}</Pill>
          {data.gigTags?.map((relation) => (
            <Pill key={relation.gigTag.id}>{relation.gigTag.name}</Pill>
          ))}
        </View>

        {data.shortDescription ? (
          <Body soft style={{ lineHeight: 22 }}>
            {data.shortDescription}
          </Body>
        ) : null}

        {soldByUs ? (
          <Button
            onPress={() =>
              router.push({
                pathname: "/(checkout)/[slug]/tiers",
                params: { slug: soldByUs.slug },
              })
            }
          >
            Get tickets
          </Button>
        ) : data.ticketLink ? (
          <Button
            variant="outline"
            onPress={() =>
              void WebBrowser.openBrowserAsync(data.ticketLink!, {
                presentationStyle:
                  WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
                controlsColor: colors.text,
                toolbarColor: colors.bg,
              })
            }
          >
            Tickets
          </Button>
        ) : (
          <Caption>Tickets aren&apos;t on sale for this one.</Caption>
        )}

        {data.gigCreators.length > 0 ? (
          <View style={{ gap: space.sm, marginTop: space.md }}>
            <Eyebrow>Line-up</Eyebrow>
            {data.gigCreators.map((entry) => (
              <View key={entry.id} style={styles.creator}>
                <Body style={{ fontWeight: "600" }}>
                  {entry.creatorProfile.displayName}
                </Body>
                {entry.creatorProfile?.tagline ? (
                  <Caption numberOfLines={1}>
                    {entry.creatorProfile.tagline}
                  </Caption>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  poster: { width: "100%", aspectRatio: 4 / 5 },
  back: {
    position: "absolute",
    left: space.lg,
    width: 36,
    height: 36,
    borderWidth: stroke.hard,
    borderColor: colors.borderHard,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  creator: {
    padding: space.md,
    backgroundColor: colors.surface,
    borderWidth: stroke.hair,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
});
