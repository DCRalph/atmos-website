import * as WebBrowser from "expo-web-browser";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";

import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { API_URL } from "@/lib/env";
import { accessLevel, isElevated } from "~/lib/ticketing/access-levels";
import { colors, radius, space } from "@/lib/theme";
import { formatGigDateLong, formatGigTime } from "@/lib/dates";
import {
  Body,
  Button,
  Caption,
  Header,
  Loading,
  Notice,
} from "@/components/ui";

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
    token?: string;
  }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  /**
   * The access token, from wherever it came in.
   *
   * From the tickets list it arrives as a query param alongside the order id.
   * From a universal link — `https://atmosmedia.co.nz/tickets/<token>`, the URL
   * in every confirmation email — the token *is* the path segment, and there is
   * no query at all. Reading both is what lets an emailed link open the app
   * instead of stranding it on a screen with nothing to fetch.
   */
  const accessToken = token ?? orderId;

  const order = api.tickets.byAccessToken.useQuery(
    { accessToken },
    { enabled: !!accessToken },
  );

  /**
   * Whether this order is already on the signed-in account.
   *
   * Read off the list the Tickets tab already loads rather than asked for
   * separately — the answer is the same, and the query is usually warm.
   */
  const { user } = useAuth();
  const mine = api.tickets.mine.useQuery(undefined, { enabled: !!user });
  const utils = api.useUtils();
  const claim = api.tickets.claim.useMutation({
    onSuccess: () => {
      void utils.tickets.mine.invalidate();
    },
  });

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/tickets");
  };

  if (order.isPending) return <Loading label="Loading tickets" />;

  if (!order.data) {
    return (
      <View style={{ flex: 1, padding: space.lg, justifyContent: "center" }}>
        <Notice
          title="Couldn't open that order"
          detail="The link may have been reissued. Pull your tickets again from the list."
          action={<Button onPress={goBack}>Back</Button>}
        />
      </View>
    );
  }

  const data = order.data;
  // Assumed until the list says otherwise, so the prompt does not flash on
  // every open while that query is still in flight.
  const isMine =
    !mine.isSuccess || mine.data.some((row) => row.orderId === data.orderId);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* A universal link from a confirmation email lands here with no screen
          behind it, so the header's back has to work either way — see goBack. */}
      <Header title={data.event.name} onBack={goBack} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: space.lg,
          paddingBottom: insets.bottom + space.xxl,
          paddingHorizontal: space.lg,
          gap: space.lg,
        }}
      >
        <View style={{ gap: 4 }}>
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

        {/*
        The other half of the Tickets tab's "bought on another email?".
        Somebody who opened a forwarded link, or a ticket bought before they
        made an account, can put it on that account from here — the token they
        already hold is the proof, so this grants nothing they cannot reach.
      */}
        {user && data.issued && !isMine ? (
          <Notice
            title="Not saved to your account"
            detail={
              claim.isError
                ? claim.error.message
                : "Save it and it shows up in your Tickets tab on any phone you sign in on."
            }
            action={
              <Button
                variant="outline"
                loading={claim.isPending}
                onPress={() => claim.mutate({ accessToken })}
              >
                Save to my account
              </Button>
            }
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
              {/* The level leads: it is what the door acts on. The tier is what
                was bought, and sits under it as a detail. */}
              <View style={styles.typeRow}>
                {isElevated(ticket.accessLevel) ? (
                  <View
                    style={[
                      styles.levelChip,
                      {
                        backgroundColor: accessLevel(ticket.accessLevel)
                          .badgeBg,
                      },
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
                <Text style={styles.tierDetail}>{ticket.tierName}</Text>
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
                {/* Google Wallet has no iOS app, so on a handset the button
                  would open a page that cannot finish. */}
                {ticket.googleWalletUrl && Platform.OS !== "ios" ? (
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
    </View>
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
  tierDetail: { color: colors.textFaint, fontSize: 11 },
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
