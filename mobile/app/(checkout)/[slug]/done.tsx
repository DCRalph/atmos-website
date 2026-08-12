import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/lib/api";
import { colors, radius, space } from "@/lib/theme";
import { Body, Button, Caption, Loading, Title } from "@/components/ui";

/**
 * Bought.
 *
 * Points straight at the wallet rather than lingering — the pass is the thing
 * they will actually hold up at the door, and the moment right after paying is
 * the one moment they are certain to act on that prompt.
 */
export default function DoneScreen() {
  const { token } = useLocalSearchParams<{ slug: string; token: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const status = api.ticketCheckout.status.useQuery(
    { accessToken: token },
    { enabled: !!token },
  );

  if (status.isPending) return <Loading label="Confirming" />;

  const order = status.data;

  return (
    <View
      style={[
        styles.wrap,
        { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.lg },
      ]}
    >
      <View style={{ flex: 1, justifyContent: "center", gap: space.md }}>
        <View style={styles.tick}>
          <Body style={{ fontSize: 30 }}>✓</Body>
        </View>
        <Title style={{ textAlign: "center" }}>You&apos;re in</Title>
        <Body soft style={{ textAlign: "center" }}>
          {order
            ? `${order.ticketCount} ${order.ticketCount === 1 ? "ticket" : "tickets"} · order ${order.orderNumber}`
            : "Your tickets are issued."}
        </Body>
        <Caption style={{ textAlign: "center" }}>
          {order?.buyerEmail
            ? `A copy is on its way to ${order.buyerEmail}.`
            : "A copy has been emailed to you."}
        </Caption>
      </View>

      <View style={{ gap: space.sm }}>
        <Button
          onPress={() =>
            router.replace({
              pathname: "/tickets/[orderId]",
              params: { orderId: order?.orderNumber ?? "", token },
            })
          }
        >
          Add to wallet
        </Button>
        <Button variant="outline" onPress={() => router.replace("/(tabs)/tickets")}>
          My tickets
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: space.lg },
  tick: {
    alignSelf: "center",
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.inDim,
    borderWidth: 2,
    borderColor: colors.in,
  },
});
