import { useCallback, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";

/**
 * Which door this phone is.
 *
 * Every scan, manual admit, denial and door sale is tagged with it, so the
 * audit trail can answer "which door let them in" when there is more than one.
 * The web scanner keeps the same value under the same concept in
 * `localStorage`; this is the app's half of that.
 *
 * Stored in SecureStore because it is the key-value store already linked into
 * the app — the label is not a secret, and nothing here depends on it being
 * encrypted.
 */
const KEY = "atmos.door.deviceLabel";

export function useDeviceLabel(): {
  deviceLabel: string;
  setDeviceLabel: (next: string) => void;
  /** False until the stored value has been read back, so a scan taken in the
      first moments of a session is not tagged with an empty label. */
  ready: boolean;
} {
  const [deviceLabel, setLabel] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    void SecureStore.getItemAsync(KEY)
      .then((stored) => {
        if (!alive) return;
        if (stored) setLabel(stored);
      })
      .catch(() => {
        // A missing or unreadable label is not worth failing a door over.
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const setDeviceLabel = useCallback((next: string) => {
    setLabel(next);
    // Fire and forget: the door should never wait on a keystroke reaching disk.
    void SecureStore.setItemAsync(KEY, next).catch(() => {
      // Same reasoning as above — losing the label costs an audit column, not
      // an admission.
    });
  }, []);

  return { deviceLabel, setDeviceLabel, ready };
}

/** What the mutations want: the label, or `undefined` when unset. */
export function labelArg(deviceLabel: string): string | undefined {
  const trimmed = deviceLabel.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
