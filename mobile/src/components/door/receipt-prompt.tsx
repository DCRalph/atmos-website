import { useCallback, useState } from "react";
import { Share, StyleSheet, TextInput, View } from "react-native";

import { api } from "@/lib/api";
import { colors, radius, space, stroke } from "@/lib/theme";
import { Body, Button, Caption } from "@/components/ui";

/**
 * Offer the customer a receipt.
 *
 * Apple's App Review checklist 5.10: a confidential digital receipt must be
 * sendable "regardless of whether a transaction is approved or declined", by
 * SMS, email, QR code or Activity view. Two channels here, and the choice
 * between them is a door problem rather than a compliance one:
 *
 * - **Share** opens the iOS Activity view with the receipt link, which is how
 *   this actually gets used — AirDrop or Messages, no typing, queue still
 *   moving.
 * - **Email** is for the person who wants it in writing, and it is the one that
 *   leaves a record on the receipt row that it was sent.
 *
 * Skippable, and that is deliberate: at a door most people take their ticket
 * and go, and a receipt step that has to be dismissed before the next sale can
 * start would cost more than it gives.
 */
export function DoorReceiptPrompt({
  receiptId,
  /** Shown on the decline path, where the framing is different. */
  declined,
}: {
  receiptId: string;
  declined?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const link = api.door.receiptLink.useQuery({ receiptId });
  const send = api.door.sendReceipt.useMutation({
    onSuccess: () => {
      setSent(true);
      setError(null);
    },
    onError: (cause) => setError(cause.message),
  });

  const onShare = useCallback(async () => {
    const url = link.data?.url;
    if (!url) return;
    try {
      await Share.share({
        message: url,
        url,
      });
    } catch {
      // Dismissing the share sheet is not an error worth reporting.
    }
  }, [link.data?.url]);

  if (sent) {
    return (
      <View style={styles.card}>
        <Body style={{ fontWeight: "700" }}>Receipt sent</Body>
        <Caption>It&apos;s on its way to {email.trim()}.</Caption>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={{ gap: space.xs }}>
        <Body style={{ fontWeight: "700" }}>
          {declined ? "Receipt for the declined card" : "Send a receipt?"}
        </Body>
        <Caption>
          {declined
            ? "Nothing was charged. If they want that in writing, send it here."
            : "Optional — most people won't want one."}
        </Caption>
      </View>

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="them@example.com"
        placeholderTextColor={colors.textFaint}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        inputMode="email"
        style={styles.input}
      />

      {error ? (
        <Caption style={{ color: colors.deny }}>{error}</Caption>
      ) : null}

      <View style={{ gap: space.sm }}>
        <Button
          loading={send.isPending}
          disabled={!email.includes("@")}
          onPress={() => send.mutate({ receiptId, email: email.trim() })}
        >
          Email receipt
        </Button>
        <Button
          variant="outline"
          disabled={!link.data?.url}
          onPress={() => void onShare()}
        >
          Share link instead
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.md,
    padding: space.lg,
    backgroundColor: colors.surface,
    borderWidth: stroke.hair,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  input: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    paddingHorizontal: space.lg,
    color: colors.text,
    fontSize: 16,
  },
});
