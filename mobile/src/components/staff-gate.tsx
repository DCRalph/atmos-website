import type { ReactNode } from "react";
import { useRouter } from "expo-router";
import { Modal, StyleSheet, View } from "react-native";

import { useStaff } from "@/lib/staff";
import { colors, space } from "@/lib/theme";
import { Button, Loading, Notice } from "@/components/ui";

/**
 * Keeps a staff route off a punter's screen.
 *
 * The server already refuses every call these screens make. This is the other
 * half: without it a deep link, a restored session or a stray `router.push`
 * renders the door and Tap to Pay screens in full, and the fact that internal
 * tooling exists is not something a customer should be able to discover.
 *
 * Wraps the navigator in a `_layout` rather than each screen, so there is one
 * place to be wrong instead of a dozen. Children stay mounted underneath for
 * the same reason `BiometricGate` keeps them: tearing a navigator down out from
 * under a cover loses where somebody was.
 */
export function StaffGate({
  role,
  children,
}: {
  /** `staff` covers door and organiser; `organiser` is the narrower one. */
  role: "staff" | "organiser";
  children: ReactNode;
}) {
  const router = useRouter();
  const { isStaff, isOrganiser, ready } = useStaff();

  const allowed = role === "organiser" ? isOrganiser : isStaff;

  return (
    <>
      {children}
      {!ready || !allowed ? (
        <Modal visible animationType="none" transparent={false}>
          <View style={styles.cover}>
            {ready ? (
              <Notice
                title="Not available"
                detail="This part of Atmos is for our team."
                action={
                  <Button
                    variant="outline"
                    onPress={() => router.replace("/(tabs)")}
                  >
                    Back to Atmos
                  </Button>
                }
              />
            ) : (
              // Covered rather than blank while the answer is in flight, so a
              // slow network never flashes the screen underneath.
              <Loading />
            )}
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  cover: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xl,
    backgroundColor: colors.bg,
  },
});
