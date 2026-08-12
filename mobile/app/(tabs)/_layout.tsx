import { Tabs } from "expo-router";
import { Text, View, type ColorValue } from "react-native";

import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/theme";

/**
 * The tab bar.
 *
 * The Door tab appears only when `door.myEvents` returns something. That query
 * is already authorised server-side and every door call re-checks, so hiding
 * the tab is a convenience for the 99% who are not staff — not the security
 * boundary.
 */
export default function TabsLayout() {
  const { user } = useAuth();
  const myEvents = api.door.myEvents.useQuery(undefined, {
    enabled: !!user,
    // A refusal here is the normal answer for a punter, not an error worth
    // retrying three times on every app launch.
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const isDoorStaff = (myEvents.data?.length ?? 0) > 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarIcon: (p) => <Glyph {...p} char="◉" /> }}
      />
      <Tabs.Screen
        name="gigs"
        options={{ title: "Gigs", tabBarIcon: (p) => <Glyph {...p} char="♫" /> }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: "Tickets",
          tabBarIcon: (p) => <Glyph {...p} char="▤" />,
        }}
      />
      <Tabs.Screen
        name="door"
        options={{
          title: "Door",
          tabBarIcon: (p) => <Glyph {...p} char="⛨" />,
          href: isDoorStaff ? "/(tabs)/door" : null,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: "More", tabBarIcon: (p) => <Glyph {...p} char="⋯" /> }}
      />
    </Tabs>
  );
}

function Glyph({ color, char }: { color: ColorValue; char: string }) {
  return (
    <View style={{ height: 24, justifyContent: "center" }}>
      <Text style={{ color, fontSize: 18 }}>{char}</Text>
    </View>
  );
}
