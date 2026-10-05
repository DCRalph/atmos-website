import type { ReactNode } from "react";
import { Linking, StyleSheet, View } from "react-native";

import { colors, space } from "@/lib/theme";
import { Button, Notice } from "@/components/ui";

/**
 * What a camera screen at the door shows until the camera is allowed.
 *
 * Keeps the door header, so Manual, List and the rest stay one tap away: a
 * handset whose camera was refused can still run the whole door by typing, and
 * without the header it had no way out of this screen at all. And once iOS has
 * been refused it never asks again, so the button opens Settings rather than
 * asking into the void.
 */
export function CameraNeeded({
  header,
  detail,
  canAskAgain,
  onAllow,
}: {
  /** The screen's `DoorHeader`. */
  header: ReactNode;
  detail: string;
  canAskAgain: boolean;
  onAllow: () => void;
}) {
  return (
    <View style={styles.screen}>
      {header}
      <View style={styles.body}>
        <Notice
          title="Camera access needed"
          detail={detail}
          action={
            canAskAgain ? (
              <Button onPress={onAllow}>Allow camera</Button>
            ) : (
              <Button onPress={() => void Linking.openSettings()}>
                Open Settings
              </Button>
            )
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { paddingHorizontal: space.lg, paddingTop: space.xxl },
});
