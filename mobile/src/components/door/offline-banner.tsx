import { useEffect, useState } from "react";
import * as Network from "expo-network";
import { StyleSheet, View } from "react-native";

import { colors, space } from "@/lib/theme";
import { Body, Caption } from "@/components/ui";

/**
 * "No signal" — said plainly, because the alternative is worse.
 *
 * Scanning is online-only by design: a ticket QR is signed against a secret
 * held in the database, so validating one needs a server read. That is a
 * deliberate trade (see `qr.ts`) and the app cannot work around it without
 * accepting duplicate entry.
 *
 * What it *can* do is be honest about it the moment it happens, rather than
 * letting a staffer discover it through a scan that hangs. The door list stays
 * usable from cache while this is up, so "is this name on it" still has an
 * answer even when "is this ticket real" does not.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let active = true;

    const check = async () => {
      const state = await Network.getNetworkStateAsync();
      if (!active) return;
      setOffline(!(state.isConnected && state.isInternetReachable !== false));
    };

    void check();
    const subscription = Network.addNetworkStateListener((state) => {
      setOffline(!(state.isConnected && state.isInternetReachable !== false));
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  if (!offline) return null;

  return (
    <View style={styles.wrap}>
      <Body style={{ color: "#000", fontWeight: "800" }}>No signal</Body>
      <Caption style={{ color: "rgba(0,0,0,0.75)" }}>
        Scans can&apos;t be checked right now. The list below still works — use
        it, and scan again once you&apos;re back on.
      </Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.warn,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    gap: 2,
  },
});
