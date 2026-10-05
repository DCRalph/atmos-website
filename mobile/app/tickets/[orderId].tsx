import { useLocalSearchParams, useRouter } from "expo-router";
import { Animated, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";

import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { mediaUrl } from "@/lib/media";
import { colors, space } from "@/lib/theme";
import { Button, Caption, IconButton, Loading, Notice } from "@/components/ui";
import { Ambient } from "@/components/poster";
import { Pass } from "@/components/pass";
import {
  HEADER_HEIGHT,
  PinnedHeader,
  useScrollHeader,
} from "@/components/screen-header";

/**
 * One order's tickets, as a pass over its poster (see `Pass`). Wallet
 * buttons hand off to the existing pass endpoints — the app holds the access
 * token, which is the only credential those need.
 */
export default function OrderScreen() {
  const { orderId, token } = useLocalSearchParams<{
    orderId: string;
    token?: string;
  }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { scrollY, scrollProps } = useScrollHeader();

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
      <Ambient
        uri={
          data.event.posterFileUploadId
            ? mediaUrl(data.event.posterFileUploadId)
            : null
        }
      />
      <Animated.ScrollView
        {...scrollProps}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + HEADER_HEIGHT + space.md,
          paddingBottom: insets.bottom + space.xxl,
          paddingHorizontal: space.lg,
          gap: space.lg,
        }}
      >
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

        {data.tickets.length > 0 ? <Pass order={data} /> : null}

        <Caption style={{ textAlign: "center" }}>
          {[data.event.venueName, `Order ${data.orderNumber}`]
            .filter(Boolean)
            .join(" · ")}
        </Caption>
      </Animated.ScrollView>

      {/* A universal link from a confirmation email lands here with no screen
          behind it, so back has to work either way — see goBack. */}
      <PinnedHeader
        scrollY={scrollY}
        solidAt={0}
        titleAt={0}
        title={data.event.name}
        left={<IconButton label="Back" icon={ArrowLeft} onPress={goBack} />}
      />
    </View>
  );
}
