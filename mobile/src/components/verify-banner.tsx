import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors, radius, space, stroke } from "@/lib/theme";
import { Body, Button, Caption } from "@/components/ui";

/**
 * "Confirm your email" — shown only to signed-in users who have not.
 *
 * It earns its place by saying what confirming actually gets them: tickets
 * bought before the app existed appear. A banner that only says "verify your
 * email" is asking for a chore with no reason attached.
 */
export function VerifyBanner() {
  const { user } = useAuth();
  const [sent, setSent] = useState(false);

  const resend = api.user.resendVerification.useMutation({
    onSuccess: () => setSent(true),
  });

  if (!user || user.emailVerified) return null;

  return (
    <View style={styles.wrap}>
      <Body style={{ fontWeight: "900", textTransform: "uppercase" }}>
        Confirm your email
      </Body>
      <Caption style={{ marginTop: 2 }}>
        {sent
          ? `Sent to ${user.email}. Tap the link and your tickets appear here.`
          : "It links tickets you already bought to this account."}
      </Caption>
      {!sent ? (
        <Button
          variant="outline"
          style={{ marginTop: space.md, height: 44 }}
          loading={resend.isPending}
          onPress={() => resend.mutate()}
        >
          Send me the link
        </Button>
      ) : null}
      {resend.isError ? (
        <Caption style={{ color: colors.deny, marginTop: space.sm }}>
          {resend.error.message}
        </Caption>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: stroke.hard,
    borderColor: colors.warn,
    backgroundColor: colors.warnDim,
  },
});
