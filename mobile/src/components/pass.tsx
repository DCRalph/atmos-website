import { useState } from "react";
import * as WebBrowser from "expo-web-browser";
import { Image } from "expo-image";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SvgXml } from "react-native-svg";
import { Wallet } from "lucide-react-native";

import type { RouterOutputs } from "@/lib/api";
import { canAddPasses } from "@/lib/apple-wallet";
import { API_URL } from "@/lib/env";
import { mediaUrl } from "@/lib/media";
import { colors, radius, space, type } from "@/lib/theme";
import { formatGigDate, formatGigTime } from "@/lib/dates";
import { isElevated } from "~/lib/ticketing/access-levels";
import { useAccessLevels } from "@/lib/access-levels";
import { Eyebrow, Display } from "@/components/ui";
import { Glass } from "@/components/glass";
import { Scrim } from "@/components/poster";

type Order = NonNullable<RouterOutputs["tickets"]["byAccessToken"]>;

/** Pass URLs come back relative when the server builds them for email. */
const absolute = (url: string) =>
  url.startsWith("http") ? url : `${API_URL}${url}`;

/**
 * The pass, as the site's ticket pages draw it: dark glass with one square
 * corner, a strip of the poster under the event's name, then the QR on
 * white. An order's tickets swipe sideways inside the one pass.
 *
 * The QR is the SVG the server already builds for the web ticket page, so
 * both surfaces show a code produced the same way. It is static for a given
 * ticket, so safe to show offline; the door validates server-side.
 *
 * `gutter` is the horizontal space around the pass, for sizing its pages.
 */
export function Pass({
  order,
  gutter = space.lg,
}: {
  order: Order;
  gutter?: number;
}) {
  const { width } = useWindowDimensions();
  const pageWidth = width - gutter * 2;
  const [page, setPage] = useState(0);
  const { level } = useAccessLevels();
  const count = order.tickets.length;
  const ticket = order.tickets[page] ?? order.tickets[0];
  const poster = order.event.posterFileUploadId
    ? mediaUrl(order.event.posterFileUploadId)
    : null;

  return (
    <View>
      <Glass dark style={styles.card}>
        <View
          style={[
            styles.header,
            !poster && { height: undefined, paddingTop: space.xl },
          ]}
        >
          {poster ? (
            <>
              <Image
                source={{ uri: poster }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
              <Scrim from={0} />
            </>
          ) : null}
          <View style={styles.headerText}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Eyebrow style={{ color: colors.textSoft }}>
                {formatGigDate(order.event.startsAt)} ·{" "}
                {formatGigTime(order.event.startsAt)}
              </Eyebrow>
              <Display
                size={24}
                keepCase
                numberOfLines={2}
                style={{ marginTop: space.sm }}
              >
                {order.event.name}
              </Display>
            </View>
            {count > 1 ? (
              <Eyebrow style={{ color: colors.textSoft }}>
                {page + 1} of {count}
              </Eyebrow>
            ) : null}
          </View>
        </View>

        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) =>
            setPage(Math.round(e.nativeEvent.contentOffset.x / pageWidth))
          }
        >
          {order.tickets.map((t) => (
            <View key={t.id} style={[styles.page, { width: pageWidth }]}>
              <View style={styles.qr}>
                <SvgXml xml={t.qrSvg} width="100%" height="100%" />
              </View>
              <Text style={styles.number}>{t.ticketNumber}</Text>
            </View>
          ))}
        </ScrollView>

        {count > 1 ? (
          <View style={styles.dots}>
            {order.tickets.map((t, i) => (
              <View
                key={t.id}
                style={[
                  styles.dot,
                  i === page && { backgroundColor: colors.text },
                ]}
              />
            ))}
          </View>
        ) : null}

        {ticket ? (
          <View style={styles.fields}>
            <Field label="Name">
              {ticket.attendeeName ?? "No name on this ticket"}
            </Field>
            <Field label="Ticket">
              {/* The level leads where it's above GA: it's what the door acts
                  on. The tier is what was bought. */}
              {isElevated(ticket.accessLevel)
                ? `${level(ticket.accessLevel).short} · ${ticket.tierName}`
                : ticket.tierName}
            </Field>
          </View>
        ) : null}
      </Glass>

      {/* Not offered on iPad, which has no Wallet app: the pass would open
          onto a blank sheet. */}
      {ticket?.appleWalletUrl && canAddPasses() ? (
        <WalletButton label="Add to Apple Wallet" url={ticket.appleWalletUrl} />
      ) : null}
      {/* Google Wallet has no iOS app, so on a handset the button would open
          a page that cannot finish. */}
      {ticket?.googleWalletUrl && Platform.OS !== "ios" ? (
        <WalletButton
          label="Add to Google Wallet"
          url={ticket.googleWalletUrl}
        />
      ) : null}
    </View>
  );
}

function Field({ label, children }: { label: string; children: string }) {
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Eyebrow style={{ fontSize: 9 }}>{label}</Eyebrow>
      <Text style={styles.fieldValue}>{children}</Text>
    </View>
  );
}

function WalletButton({ label, url }: { label: string; url: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => void WebBrowser.openBrowserAsync(absolute(url))}
      style={({ pressed }) => [styles.wallet, pressed && { opacity: 0.75 }]}
    >
      <Wallet color={colors.text} size={16} strokeWidth={2} />
      <Text style={styles.walletLabel}>{label}</Text>
    </Pressable>
  );
}

/**
 * A pass tucked behind the front one in the stack: just its poster strip
 * and name. Tapping it opens that order.
 */
export function PassStrip({
  name,
  note,
  posterFileUploadId,
  onPress,
  stacked = true,
}: {
  name: string;
  note: string;
  posterFileUploadId: string | null;
  onPress: () => void;
  /** Overlap the next card, Wallet style. Off for a plain list. */
  stacked?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${note}`}
      onPress={onPress}
      style={stacked ? { marginBottom: -26 } : { marginBottom: space.md }}
    >
      {({ pressed }) => (
        <Glass dark style={[styles.strip, pressed && { opacity: 0.8 }]}>
          {posterFileUploadId ? (
            <Image
              source={{ uri: mediaUrl(posterFileUploadId) }}
              style={[StyleSheet.absoluteFill, { opacity: 0.4 }]}
              contentFit="cover"
            />
          ) : null}
          <View style={[styles.stripRow, stacked && { paddingBottom: 26 }]}>
            <Display size={16} keepCase numberOfLines={1} style={{ flex: 1 }}>
              {name}
            </Display>
            <Eyebrow style={{ color: colors.textSoft }}>{note}</Eyebrow>
          </View>
        </Glass>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Square at the top left, like every panel on the site's ticket pages.
  card: { borderRadius: radius.lg, borderTopLeftRadius: 0 },
  header: { height: 148, justifyContent: "flex-end" },
  headerText: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
  },
  page: { alignItems: "center", paddingTop: space.xl },
  qr: { width: 224, height: 224, backgroundColor: "#fff", padding: space.md },
  number: { ...type.mono, color: colors.textFaint, marginTop: space.md },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: space.md,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  fields: {
    flexDirection: "row",
    gap: space.lg,
    marginTop: space.xl,
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderStrong,
  },
  fieldValue: { ...type.body, color: colors.text, marginTop: 6 },
  wallet: {
    height: 48,
    marginTop: space.md,
    borderRadius: radius.pill,
    backgroundColor: "#000",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
  },
  walletLabel: { ...type.label, fontSize: 12, color: colors.text },
  strip: { height: 84, borderRadius: radius.lg, borderTopLeftRadius: 0 },
  stripRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.xl,
  },
});
