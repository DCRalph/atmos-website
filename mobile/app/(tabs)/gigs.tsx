import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";

import { api } from "@/lib/api";
import { colors, space } from "@/lib/theme";
import { Eyebrow, Header, Loading, Notice } from "@/components/ui";
import { GigTile } from "@/components/gig-card";

export default function GigsScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const upcoming = api.gigs.getUpcoming.useQuery();
  const past = api.gigs.getPast.useQuery({ limit: 20 });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([upcoming.refetch(), past.refetch()]);
    setRefreshing(false);
  }, [upcoming, past]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Gigs" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: space.lg,
          paddingBottom: space.xxl,
          paddingHorizontal: space.lg,
          gap: space.xl,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.textFaint}
          />
        }
      >
        {upcoming.isPending ? (
          <Loading />
        ) : (upcoming.data?.length ?? 0) === 0 ? (
          <Notice
            title="Nothing coming up"
            detail="New dates land here first."
          />
        ) : (
          <View style={{ gap: space.md }}>
            <Eyebrow>Upcoming</Eyebrow>
            {upcoming.data?.map((gig) => (
              <GigTile key={gig.id} gig={gig} wide />
            ))}
          </View>
        )}

        {(past.data?.length ?? 0) > 0 && (
          <View style={{ gap: space.md }}>
            <Eyebrow>Been and gone</Eyebrow>
            {past.data?.map((gig) => (
              <GigTile key={gig.id} gig={gig} wide />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
