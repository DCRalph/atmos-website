import { Tabs } from "expo-router";

import { colors } from "@/lib/theme";
import { TabBar } from "@/components/tab-bar";

/**
 * Home is the anchor, explicitly.
 *
 * Without this the router falls back to the alphabetically-first route in the
 * directory, which is how a customer app ended up opening on a door scanner.
 */
export const unstable_settings = { anchor: "index" };

/**
 * The tabs, under the floating glass bar (`TabBar`).
 *
 * Every tab here is a customer's app. Door mode is staff tooling and does not
 * get one — it hangs off the account card in `more`, and lives full-screen
 * outside the tabs.
 */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="gigs" options={{ title: "Gigs" }} />
      <Tabs.Screen name="tickets" options={{ title: "Tickets" }} />
      <Tabs.Screen name="more" options={{ title: "More" }} />
    </Tabs>
  );
}
