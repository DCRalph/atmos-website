import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, Modal, StyleSheet, View } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

import { useAuth } from "@/lib/auth";
import { colors, space } from "@/lib/theme";
import { Body, Button, Caption, Title } from "@/components/ui";

/**
 * Face ID and Touch ID.
 *
 * Apple's App Review checklist 1.7 (recommended): "Merchants should be able to
 * use FaceID or TouchID for a seamless login experience on apps available on
 * the public App Store."
 *
 * The session already lives in SecureStore, so somebody who signed in stays
 * signed in. What biometrics buy is the door case: a shared handset that gets
 * put down on a bar, picked up by whoever, and is one tap away from the guest
 * list and the card reader. Locking the app rather than the session is the
 * right trade — nobody should be typing a password at a door in the dark.
 *
 * Two rules it never breaks:
 *
 * - **Opt-in.** Off until somebody turns it on, because enrolling the app in a
 *   biometric that the phone's owner has not set up would just lock them out.
 * - **Never a dead end.** A failed or cancelled scan leaves a screen with a
 *   retry and a way to sign out. Being unable to get into the app at a door
 *   because Face ID cannot see you in the dark is a worse outcome than the one
 *   this is protecting against.
 */

const PREFERENCE_KEY = "atmos.biometric-lock";

/**
 * How long the app may sit in the background before it re-locks.
 *
 * Long enough to answer a text or scan a ticket in another app without being
 * challenged again; short enough that a phone left on a bar is not open.
 */
const RELOCK_AFTER_MS = 60_000;

type BiometricContextValue = {
  /** The hardware exists and somebody has enrolled a face or a finger. */
  available: boolean;
  enabled: boolean;
  setEnabled: (next: boolean) => Promise<void>;
  /** What the phone actually offers, for labelling the toggle honestly. */
  label: string;
};

const BiometricContext = createContext<BiometricContextValue>({
  available: false,
  enabled: false,
  setEnabled: async () => undefined,
  label: "Face ID",
});

export const useBiometrics = () => useContext(BiometricContext);

export function BiometricLockProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [available, setAvailable] = useState(false);
  const [label, setLabel] = useState("Face ID");
  const [enabled, setEnabledState] = useState(false);
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [failed, setFailed] = useState(false);

  const backgroundedAt = useRef<number | null>(null);
  const prompting = useRef(false);

  // What this handset can do, and what to call it.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const [hasHardware, isEnrolled, types] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        LocalAuthentication.supportedAuthenticationTypesAsync(),
      ]);
      if (!alive) return;

      setAvailable(hasHardware && isEnrolled);
      setLabel(
        types.includes(
          LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
        )
          ? "Face ID"
          : "Touch ID",
      );
    })();
    return () => {
      alive = false;
    };
  }, []);

  // The stored preference, and the initial lock that follows from it.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const stored = await SecureStore.getItemAsync(PREFERENCE_KEY).catch(
        () => null,
      );
      if (!alive) return;
      const on = stored === "1";
      setEnabledState(on);
      setLocked(on);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const prompt = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    setFailed(false);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Atmos",
        // The device passcode is the fallback Apple expects. Without it, a
        // damp-handed staffer whose Touch ID will not read has no way in.
        disableDeviceFallback: false,
        cancelLabel: "Cancel",
      });
      if (result.success) {
        setLocked(false);
        setFailed(false);
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      prompting.current = false;
    }
  }, []);

  // Ask as soon as the lock goes up, so unlocking is one glance rather than a
  // tap and then a glance.
  useEffect(() => {
    if (!locked || !ready) return;
    void prompt();
  }, [locked, ready, prompt]);

  // Re-lock after a real absence, not after a glance at Control Centre.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "background" || next === "inactive") {
        backgroundedAt.current ??= Date.now();
        return;
      }
      if (next !== "active") return;

      const since = backgroundedAt.current;
      backgroundedAt.current = null;
      if (!enabled || since === null) return;
      if (Date.now() - since < RELOCK_AFTER_MS) return;
      setLocked(true);
    });
    return () => subscription.remove();
  }, [enabled]);

  const setEnabled = useCallback(
    async (next: boolean) => {
      if (next) {
        // Prove it works before relying on it. Turning the lock on with a
        // biometric that cannot read is how somebody gets shut out.
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: `Turn on ${label} for Atmos`,
          disableDeviceFallback: false,
        });
        if (!result.success) return;
      }

      await SecureStore.setItemAsync(PREFERENCE_KEY, next ? "1" : "0").catch(
        () => undefined,
      );
      setEnabledState(next);
      if (!next) setLocked(false);
    },
    [label],
  );

  const value = useMemo<BiometricContextValue>(
    () => ({ available, enabled, setEnabled, label }),
    [available, enabled, setEnabled, label],
  );

  return (
    <BiometricContext.Provider value={value}>
      {children}
      {/* Only ever over a signed-in app: there is nothing behind a signed-out
          one worth locking, and challenging somebody before they have an
          account would be nonsense. */}
      {locked && ready && !!user ? (
        <LockScreen label={label} failed={failed} onRetry={() => void prompt()} />
      ) : null}
    </BiometricContext.Provider>
  );
}

function LockScreen({
  label,
  failed,
  onRetry,
}: {
  label: string;
  failed: boolean;
  onRetry: () => void;
}) {
  return (
    <Modal visible animationType="fade" transparent={false}>
      <View style={styles.lock}>
        <Title>Atmos</Title>
        <Body soft style={{ textAlign: "center" }}>
          {failed
            ? `${label} didn't unlock. Try again, or use your device passcode.`
            : `Unlock with ${label}.`}
        </Body>
        <Button onPress={onRetry}>Unlock</Button>
        <Caption style={{ textAlign: "center" }}>
          You can turn this off in More › Account.
        </Caption>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  lock: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.lg,
    padding: space.xl,
    backgroundColor: colors.bg,
  },
});
