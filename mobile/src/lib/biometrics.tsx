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
 * Face ID and Touch ID, over the staff areas only.
 *
 * Apple's App Review checklist 1.7 (recommended): "Merchants should be able to
 * use FaceID or TouchID for a seamless login experience on apps available on
 * the public App Store."
 *
 * The session already lives in SecureStore, so somebody who signed in stays
 * signed in. What biometrics buy is the door case: a shared handset that gets
 * put down on a bar, picked up by whoever, and is one tap away from the guest
 * list and the card reader.
 *
 * So the lock sits on the Internal section of More and on the `(door)` and
 * `(admin)` routes it leads to, and nowhere else. A punter opening the app to
 * show a ticket at a turnstile is not challenged, because there is nothing
 * behind their own ticket worth locking and a scan that waits on a face in a
 * dark queue is worse than no lock at all.
 *
 * Two ways to use it, and both are needed. `useBiometricGate` is for a surface
 * that collapses in place, which is what the Internal section does. Wrapping a
 * navigator in `BiometricGate` covers the routes themselves, so a deep link or
 * a notification tap cannot walk in behind the section.
 *
 * Two rules it never breaks:
 *
 * - **Opt-in.** Off until somebody turns it on, because enrolling the app in a
 *   biometric that the phone's owner has not set up would just lock them out.
 * - **Never a dead end.** A failed or cancelled scan leaves a screen with a
 *   retry and a way out. Being unable to get into door mode because Face ID
 *   cannot see you in the dark is a worse outcome than the one this protects
 *   against.
 */

const PREFERENCE_KEY = "atmos.biometric-lock";

/**
 * How long the app may sit in the background before a staff area re-locks.
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

/** Everything `BiometricGate` needs, kept out of the public value. */
type GateState = {
  ready: boolean;
  locked: boolean;
  failed: boolean;
  prompt: () => void;
};

const GateContext = createContext<GateState>({
  ready: false,
  locked: false,
  failed: false,
  prompt: () => undefined,
});

export const useBiometrics = () => useContext(BiometricContext);

export function BiometricLockProvider({ children }: { children: ReactNode }) {
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

  // The stored preference. Starting locked costs nothing now that the lock is
  // only felt on the way into a staff area.
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

  const prompt = useCallback(() => {
    if (prompting.current) return;
    prompting.current = true;
    setFailed(false);

    void (async () => {
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
    })();
  }, []);

  // Re-lock after a real absence, not after a glance at Control Centre. This
  // runs whatever screen is open; it is only ever noticed on the next visit to
  // a staff area.
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
      // Turning it on from inside the app should not immediately challenge the
      // person who just proved who they are.
      setLocked(false);
    },
    [label],
  );

  const value = useMemo<BiometricContextValue>(
    () => ({ available, enabled, setEnabled, label }),
    [available, enabled, setEnabled, label],
  );

  const gate = useMemo<GateState>(
    () => ({ ready, locked: enabled && locked, failed, prompt }),
    [ready, enabled, locked, failed, prompt],
  );

  return (
    <BiometricContext.Provider value={value}>
      <GateContext.Provider value={gate}>{children}</GateContext.Provider>
    </BiometricContext.Provider>
  );
}

/**
 * The lock, for a surface that guards itself in place rather than by route —
 * the Internal section in More, which is a group of rows that stay collapsed
 * behind a single locked row until somebody taps it.
 *
 * Deliberately does not prompt on its own. A section sitting in a scroll view
 * that somebody is passing on the way to Terms should not throw Face ID at
 * them; the tap is what asks.
 */
export function useBiometricGate(): {
  /** True when the lock should be covering something right now. */
  guarded: boolean;
  failed: boolean;
  prompt: () => void;
} {
  const { user } = useAuth();
  const { ready, locked, failed, prompt } = useContext(GateContext);

  // Nothing behind a signed-out app is worth locking, and challenging somebody
  // before they have an account would be nonsense.
  return { guarded: ready && locked && !!user, failed, prompt };
}

/**
 * Wraps a staff area. Put it around the navigator in a `_layout`, not around
 * individual screens, so a deep link into the middle of door mode is covered
 * as well as the way in through More — the Internal section guards the way in,
 * this guards every other way.
 *
 * Children stay mounted behind the lock rather than being torn down: the lock
 * is a cover over a screen somebody is coming back to, and unmounting the
 * navigator underneath it loses where they were.
 */
export function BiometricGate({ children }: { children: ReactNode }) {
  const { guarded, failed, prompt } = useBiometricGate();
  const { label } = useBiometrics();

  // Unlike the inline section, a route gate asks as soon as the lock goes up:
  // somebody who has navigated into door mode is asking to be let in.
  useEffect(() => {
    if (guarded) prompt();
  }, [guarded, prompt]);

  return (
    <>
      {children}
      {guarded ? (
        <LockScreen label={label} failed={failed} onRetry={prompt} />
      ) : null}
    </>
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
        <Title>Internal</Title>
        <Body soft style={{ textAlign: "center" }}>
          {failed
            ? `${label} didn't unlock. Try again, or use your device passcode.`
            : `Unlock with ${label}.`}
        </Body>
        <Button onPress={onRetry}>Unlock</Button>
        <Caption style={{ textAlign: "center" }}>
          Your tickets are open without this. Turn it off in More, under
          Internal.
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
