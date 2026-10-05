import { Linking, StyleSheet, View } from "react-native";

import { colors, space } from "@/lib/theme";
import { Button, Notice } from "@/components/ui";
import { DoorHeaderSpace } from "@/components/door/door-header";

/**
 * What a camera screen at the door shows until the camera is allowed.
 *
 * Sits under the door header, so Manual, List and the rest stay one tap away:
 * a handset whose camera was refused can still run the whole door by typing.
 * And once iOS has been refused it never asks again, so the button opens
 * Settings rather than asking into the void.
 */
export function CameraNeeded({
  detail,
  canAskAgain,
  onAllow,
}: {
  detail: string;
  canAskAgain: boolean;
  onAllow: () => void;
}) {
  return (
    <View style={styles.screen}>
      <DoorHeaderSpace />
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
