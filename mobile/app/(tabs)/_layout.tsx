import { Tabs } from "expo-router";
import { View, type ColorValue } from "react-native";
import { CalendarDays, House, Menu, Ticket } from "lucide-react-native";

import { colors } from "@/lib/theme";

/**
 * Home is the anchor, explicitly.
 *
 * Without this the router falls back to the alphabetically-first route in the
 * directory, which is how a customer app ended up opening on a door scanner.
 */
export const unstable_settings = { anchor: "index" };

/**
 * The tab bar.
 *
 * Every tab here is a customer's app. Door mode is staff tooling and does not
 * get one — it hangs off the account card in `more`, and lives full-screen
 * outside the tabs.
 */
export default function TabsLayout() {
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
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "900",
          letterSpacing: 1,
          textTransform: "uppercase",
        },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarIcon: (p) => <Glyph {...p} icon={House} /> }}
      />
      <Tabs.Screen
        name="gigs"
        options={{
          title: "Gigs",
          tabBarIcon: (p) => <Glyph {...p} icon={CalendarDays} />,
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: "Tickets",
          tabBarIcon: (p) => <Glyph {...p} icon={Ticket} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: "More", tabBarIcon: (p) => <Glyph {...p} icon={Menu} /> }}
      />
    </Tabs>
  );
}

/** Lucide, the same set the website draws its icons from. */
function Glyph({
  color,
  icon: Icon,
}: {
  color: ColorValue;
  icon: typeof House;
}) {
  return (
    <View style={{ height: 24, justifyContent: "center" }}>
      <Icon color={color as string} size={20} strokeWidth={2} />
    </View>
  );
}
