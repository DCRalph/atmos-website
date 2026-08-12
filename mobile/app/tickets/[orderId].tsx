import * as WebBrowser from "expo-web-browser";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";

import { api } from "@/lib/api";
import { API_URL } from "@/lib/env";
import { accessLevel, isElevated } from "~/lib/ticketing/access-levels";
import { colors, radius, space } from "@/lib/theme";
import { formatGigDateLong, formatGigTime } from "@/lib/dates";
import { Body, Button, Caption, Loading, Notice, Title } from "@/components/ui";

/**
 * One order's tickets.
 *
 * The QR is rendered from the SVG the server already builds for the web ticket
 * page, so both surfaces show a code produced the same way. Wallet buttons hand
 * off to the existing pass endpoints — the app holds the access token, which is
 * the only credential those need.
 */
export default function OrderScreen() {
  const { orderId, token } = useLocalSearchParams<{
    orderId: string;
    token: string;
  }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const order = api.tickets.byAccessToken.useQuery(
    { accessToken: token },
    { enabled: !!token },
  );

  if (order.isPending) return <Loading label="Loading tickets" />;

  if (!order.data) {
    return (
      <View style={{ flex: 1, padding: space.lg, justifyContent: "center" }}>
        <Notice
          title="Couldn't open that order"
          detail="The link may have been reissued. Pull your tickets again from the list."
          action={<Button onPress={() => router.back()}>Back</Button>}
        />
      </View>
    );
  }

  const data = order.data;

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
      <View style={{ gap: 4 }}>
        <Title>{data.event.name}</Title>
        <Caption>
          {formatGigDateLong(data.event.startsAt)} ·{" "}
          {formatGigTime(data.event.startsAt)}
        </Caption>
        {data.event.venueName ? (
          <Caption>{data.event.venueName}</Caption>
        ) : null}
      </View>

      {!data.issued ? (
        <Notice
          title="Not issued yet"
          detail="This order hasn't finished paying. Tickets appear once it does."
        />
      ) : null}

      {data.tickets.map((ticket) => (
        <View key={ticket.id} style={styles.ticket}>
          <View style={styles.qrWrap}>
            {/* The QR is static for a given qrVersion, so it is safe to cache
                and safe to show offline — the door validates server-side
                regardless, which is where the security actually lives. */}
            <SvgXml xml={ticket.qrSvg} width="100%" height="100%" />
          </View>

          <View style={{ padding: space.lg, gap: 4 }}>
            <Body style={{ fontWeight: "700" }}>
              {ticket.attendeeName ?? "No name on this ticket"}
            </Body>
            <View style={styles.typeRow}>
              <Caption>{ticket.tierName}</Caption>
              {isElevated(ticket.accessLevel) ? (
                <View
                  style={[
                    styles.levelChip,
                    { backgroundColor: accessLevel(ticket.accessLevel).badgeBg },
                  ]}
                >
                  <Text
                    style={[
                      styles.levelChipLabel,
                      { color: accessLevel(ticket.accessLevel).badgeFg },
                    ]}
                  >
                    {accessLevel(ticket.accessLevel).short}
                  </Text>
                </View>
              ) : null}
            </View>
            <Caption style={{ fontFamily: "Menlo" }}>
              {ticket.ticketNumber}
            </Caption>

            <View style={{ gap: space.sm, marginTop: space.md }}>
              {ticket.appleWalletUrl ? (
                <Button
                  variant="outline"
                  onPress={() =>
                    void WebBrowser.openBrowserAsync(
                      absolute(ticket.appleWalletUrl!),
                    )
                  }
                >
                  Add to Apple Wallet
                </Button>
              ) : null}
              {ticket.googleWalletUrl ? (
                <Button
                  variant="outline"
                  onPress={() =>
                    void WebBrowser.openBrowserAsync(
                      absolute(ticket.googleWalletUrl!),
                    )
                  }
                >
                  Add to Google Wallet
                </Button>
              ) : null}
            </View>
          </View>
        </View>
      ))}

      <Caption style={{ textAlign: "center" }}>
        Order {data.orderNumber}
      </Caption>
    </ScrollView>
  );
}

/** Pass URLs come back relative when the server builds them for email. */
function absolute(url: string): string {
  return url.startsWith("http") ? url : `${API_URL}${url}`;
}

const styles = StyleSheet.create({
  typeRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  levelChip: { paddingHorizontal: space.sm, paddingVertical: 2 },
  levelChipLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  ticket: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  qrWrap: {
    aspectRatio: 1,
    backgroundColor: "#fff",
    padding: space.xl,
  },
});
