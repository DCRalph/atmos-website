import { useMemo } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";

import { api } from "@/lib/api";
import { formatGigTime } from "@/lib/dates";
import { colors, space, stroke } from "@/lib/theme";
import { Body, Caption, Eyebrow, Loading, Notice, Pill, Title } from "@/components/ui";

/**
 * Tonight's run sheet.
 *
 * Read-only. What it is for is the ten seconds after a cue lands on a lock
 * screen: what just happened, what is next, and how long there is. Everything
 * is drawn from the same rows the notifications are derived from, so the screen
 * and the push cannot disagree.
 *
 * Open to everybody working the night. A door person sees the shape of it;
 * internal notes and who is being told what stay with the organisers, and the
 * server is what withholds them rather than this screen.
 *
 * `previousSetName` comes from the server rather than being worked out here for
 * the same reason: a changeover is defined by the row in front of it, and two
 * implementations of "the row in front" is one too many.
 */
export default function RunSheetScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { gigId } = useLocalSearchParams<{ gigId: string }>();

  const runSheet = api.runSheet.forGig.useQuery(
    { gigId: gigId ?? "" },
    {
      enabled: !!gigId,
      retry: false,
      // A run sheet moves during the night. Cheap to refetch, expensive to be
      // wrong about.
      refetchInterval: 60_000,
    },
  );

  const nextIndex = useMemo(() => {
    const items = runSheet.data?.items ?? [];
    const now = Date.now();
    return items.findIndex(
      (item) => item.startsAt && new Date(item.startsAt).getTime() > now,
    );
  }, [runSheet.data]);

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

      {runSheet.isPending ? <Loading label="Loading run sheet" /> : null}

      {runSheet.isError ? (
        <Notice
          title="Not on this one"
          detail="You can see the run sheet for gigs you are working. Ask an organiser if this should be one of them."
        />
      ) : null}

      {runSheet.isSuccess && !runSheet.data ? (
        <Notice title="No such gig" detail="It may have been deleted." />
      ) : null}

      {runSheet.data ? (
        <>
          <View style={{ gap: space.xs }}>
            <Eyebrow>{runSheet.data.subtitle}</Eyebrow>
            <Title>{runSheet.data.title}</Title>
          </View>

          {runSheet.data.items.length === 0 ? (
            <Notice
              title="Nothing scheduled"
              detail="Doors, sound check and set times are added on the web admin."
            />
          ) : null}

          <View style={{ gap: 0 }}>
            {runSheet.data.items.map((item, index) => {
              const sent = item.fires.filter((fire) => !fire.skipped).length;

              return (
                <View
                  key={item.id}
                  style={[styles.row, index === nextIndex && styles.rowNext]}
                >
                  <View style={styles.time}>
                    <Body style={{ fontWeight: "700" }}>
                      {item.startsAt ? formatGigTime(item.startsAt) : "--"}
                    </Body>
                    {item.endsAt ? (
                      <Caption>{formatGigTime(item.endsAt)}</Caption>
                    ) : null}
                  </View>

                  <View style={{ flex: 1, gap: space.xs }}>
                    <View style={styles.nameRow}>
                      <Body style={{ fontWeight: "600" }}>{item.name}</Body>
                      {index === nextIndex ? <Pill tone="in">Next</Pill> : null}
                      {sent > 0 ? <Pill>Sent</Pill> : null}
                    </View>

                    {item.previousSetName ? (
                      <Caption>Changeover from {item.previousSetName}</Caption>
                    ) : null}
                    {item.role ? <Caption>{item.role}</Caption> : null}
                    {item.notes ? (
                      <Body soft style={{ marginTop: space.xs }}>
                        {item.notes}
                      </Body>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>

          {runSheet.data.recipients.length > 0 ? (
            <View style={{ gap: space.xs, marginTop: space.md }}>
              <Eyebrow>Cues go to</Eyebrow>
              <Caption>
                {runSheet.data.recipients
                  .map((person) => person.name)
                  .join(", ")}
              </Caption>
            </View>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  row: {
    flexDirection: "row",
    gap: space.lg,
    paddingVertical: space.md,
    borderTopWidth: stroke.hair,
    borderTopColor: colors.border,
  },
  // The next cue is the only thing on this screen anybody is looking for in a
  // dark room, so it gets the one strong edge.
  rowNext: {
    borderLeftWidth: stroke.hard,
    borderLeftColor: colors.text,
    paddingLeft: space.md,
  },
  time: { width: 76 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    flexWrap: "wrap",
  },
});
