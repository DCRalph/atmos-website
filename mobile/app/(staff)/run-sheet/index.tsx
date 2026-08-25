import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import { isToday } from "date-fns";

import { api } from "@/lib/api";
import { formatGigDate, formatGigTime } from "@/lib/dates";
import { colors, radius, space, stroke } from "@/lib/theme";
import { Body, Caption, Eyebrow, Loading, Notice, Pill, Title } from "@/components/ui";

/**
 * Which run sheet.
 *
 * Almost always one, often none, which is why this is a short list and not a
 * search. What counts as "on" is anything with a cue within twelve hours either
 * way, so a load-in at four in the afternoon puts the night on this screen
 * before the gig has started.
 *
 * An organiser sees every gig. A door person sees the gigs they are rostered
 * on, and the server decides which those are.
 */
export default function RunSheetListScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const gigs = api.runSheet.tonight.useQuery(undefined, {
    retry: false,
    // Somebody leaves this open on a bar. A night that starts while they are
    // looking at it should appear.
    refetchInterval: 5 * 60_000,
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + space.lg,
        paddingBottom: space.xxl,
        paddingHorizontal: space.lg,
        gap: space.lg,
      }}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft color={colors.text} size={22} strokeWidth={2.5} />
        </Pressable>
        <Title>Run sheet</Title>
      </View>

      {gigs.isPending ? <Loading label="Loading" /> : null}

      {gigs.isError ? (
        <Notice
          title="Not available"
          detail="Run sheets are for the team working the night."
        />
      ) : null}

      {gigs.data?.length === 0 ? (
        <Notice
          title="Nothing on"
          detail="A gig appears here from a few hours before its first cue until a few hours after its last."
        />
      ) : null}

      {gigs.data?.map((gig) => (
        <Pressable
          key={gig.id}
          onPress={() =>
            router.push({
              pathname: "/run-sheet/[gigId]",
              params: { gigId: gig.id },
            })
          }
          style={styles.row}
        >
          <View style={styles.rowTop}>
            <Text numberOfLines={2} style={styles.name}>
              {gig.title}
            </Text>
            {isToday(gig.gigStartTime) ? <Pill tone="in">Tonight</Pill> : null}
          </View>
          <Eyebrow>{gig.subtitle}</Eyebrow>
          <Caption numberOfLines={1}>
            {formatGigDate(gig.gigStartTime)} · {formatGigTime(gig.gigStartTime)}
          </Caption>
        </Pressable>
      ))}

      <Body soft style={{ marginTop: space.md }}>
        Times, sets and changeovers are set on the web admin.
      </Body>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: space.md },
  row: {
    borderWidth: stroke.hard,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: space.lg,
    gap: space.xs,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space.md,
  },
  name: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: -0.3,
    flex: 1,
    minWidth: 0,
  },
});
