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
import { AppState, Platform } from "react-native";
import {
  DarkMode,
  StripeTerminalProvider,
  useStripeTerminal,
  type Reader,
} from "@stripe/stripe-terminal-react-native";

import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/theme";

/**
 * Tap to Pay on iPhone — the whole lifecycle, in one place.
 *
 * This exists because Apple's App Review checklist treats Tap to Pay as an
 * app-level capability rather than a checkout detail, and the requirements only
 * make sense together:
 *
 * - **1.5 / 5.6** the reader must be warmed up at launch and on foreground, so
 *   that pressing the pay button opens Apple's sheet inside a second. Doing it
 *   when the sell sheet opens — which is what this replaced — spends discovery
 *   and connect time while somebody is standing at the door.
 * - **1.6** whether the merchant has accepted the Terms and Conditions must be
 *   read from Apple, never cached. Nothing here persists it; every launch asks
 *   again by attempting a connect.
 * - **3.8 / 3.8.1** only an authorized party may accept those terms. The server
 *   decides who that is; `tosAcceptancePermitted` is how the decision is
 *   enforced against the SDK.
 * - **3.9.1 / 5.7** configuration progress has to be visible while the reader
 *   prepares.
 * - **1.1 / 1.4** an unsupported handset and an out-of-date iOS are different
 *   problems with different fixes, and must not collapse into one message.
 *
 * See `docs/ticketing/TAP-TO-PAY-APP-REVIEW.md`.
 */

/**
 * Below this, Apple's reader refuses to configure and the SDK surfaces it as a
 * generic failure — checklist row 1.4 exists precisely because that failure is
 * unreadable to a merchant. Checked here, before any SDK call, so the answer is
 * "update iOS" rather than "something went wrong".
 *
 * Apple's Business Register is the authority and it moves as versions age out:
 * <https://register-docs.apple.com/tap-to-pay-on-iphone/docs/sdk-and-api-guide>
 */
export const MIN_TAP_TO_PAY_IOS = 17.6;

export type UnsupportedReason =
  /** Not an iPhone. Tap to Pay on iPhone is iOS-only by definition. */
  | "platform"
  /** iOS too old — the one the merchant can actually fix. */
  | "os"
  /** iPhone older than XS, or missing the entitlement in this build. */
  | "device"
  /** Jailbroken, or a debug build Apple will not let take real money. */
  | "insecure"
  /** Stripe has blocked or deactivated card acceptance for the account. */
  | "account";

export type TapToPayState =
  /** Not door staff. Tap to Pay is never mentioned to a punter. */
  | { status: "ineligible" }
  | { status: "unsupported"; reason: UnsupportedReason; message: string }
  /** Initialising, checking support, discovering, connecting. */
  | { status: "preparing" }
  /** Connected but Apple is still configuring the reader — 3.9.1, 5.7. */
  | { status: "configuring"; progress: number | null }
  /**
   * The handset can do Tap to Pay but has not been set up on this Apple
   * Account. `canAccept` is the server's answer to "may this person accept the
   * Terms and Conditions?" — 3.8, and its refusal message is 3.8.1.
   */
  | { status: "needs-setup"; canAccept: boolean }
  | { status: "ready" }
  /** Network, connection token, session — worth another go. */
  | { status: "error"; message: string };

export type TapToPayContextValue = {
  state: TapToPayState;
  /** Collecting a payment right now will work. */
  isReady: boolean;
  /**
   * Deliberately accept Apple's Terms and Conditions on this handset.
   *
   * The **only** path in the app that connects with `tosAcceptancePermitted`
   * true, and therefore the only one that can raise Apple's acceptance sheet.
   * Rejects when the caller is not authorized — the server's answer, not the
   * app's guess.
   */
  acceptTerms: () => Promise<void>;
  /** Run the warm-up again after a retryable failure. */
  retry: () => void;
  /**
   * True once Apple has told us acceptance happened in this session. Drives the
   * education screens that must follow it (4.2) and the "try it out" invite
   * (3.9) — not a persisted flag, and never a substitute for asking the SDK.
   */
  justAcceptedTerms: boolean;
  acknowledgeAcceptance: () => void;
};

const noop = () => undefined;

const TapToPayContext = createContext<TapToPayContextValue>({
  state: { status: "ineligible" },
  isReady: false,
  acceptTerms: async () => undefined,
  retry: noop,
  justAcceptedTerms: false,
  acknowledgeAcceptance: noop,
});

export const useTapToPay = () => useContext(TapToPayContext);

/** Current iOS major.minor as a number, or null off iOS. */
function iosVersion(): number | null {
  if (Platform.OS !== "ios") return null;
  const raw = String(Platform.Version);
  const [major, minor] = raw.split(".");
  const parsed = Number(`${major ?? "0"}.${minor ?? "0"}`);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Turn an SDK failure into something a person at a door can act on.
 *
 * The Stripe React Native SDK flattens several distinct Apple failures onto
 * shared codes — `tapToPayReaderTOSNotYetAccepted` and a genuinely failed
 * reader update both arrive as `READER_SOFTWARE_UPDATE_FAILED`. So this maps
 * only the codes that are unambiguous, and everything else is treated as
 * retryable rather than guessed at. Which terms have and have not been accepted
 * is decided by attempting a connect, not by reading an error string.
 */
function describeError(error: { code?: string; message?: string } | undefined): {
  reason: UnsupportedReason | null;
  message: string;
} {
  const message =
    error?.message ?? "Tap to Pay on iPhone isn't available right now.";

  switch (error?.code) {
    case "TAP_TO_PAY_UNSUPPORTED_DEVICE":
    case "TAP_TO_PAY_UNSUPPORTED_PROCESSOR":
    case "TAP_TO_PAY_LIBRARY_NOT_INCLUDED":
    case "UNSUPPORTED_READER_VERSION":
      return {
        reason: "device",
        message:
          "This iPhone can't take payments with Tap to Pay on iPhone. It needs to be an iPhone XS or later.",
      };
    case "TAP_TO_PAY_DEVICE_TAMPERED":
    case "TAP_TO_PAY_INSECURE_ENVIRONMENT":
    case "TAP_TO_PAY_DEBUG_NOT_SUPPORTED":
      return {
        reason: "insecure",
        message:
          "This iPhone isn't in a state Apple will accept card payments on. Use another handset and take cash for now.",
      };
    case "TAP_TO_PAY_READER_MERCHANT_BLOCKED":
      return {
        reason: "account",
        message:
          "Card payments are blocked on the Atmos account. Contact an admin — this can't be fixed on the phone.",
      };
    case "FEATURE_NOT_ENABLED_ON_ACCOUNT":
      return {
        reason: "account",
        message:
          "Tap to Pay on iPhone isn't enabled on the Atmos Stripe account yet. Contact an admin.",
      };
    default:
      return { reason: null, message };
  }
}

/**
 * Bringing the SDK up and keeping a reader attached.
 *
 * `StripeTerminalProvider` does not initialize anything by itself — it hands
 * `initialize` out through context and waits to be asked. Until something asks,
 * every other call fails with "First initialize the Stripe Terminal SDK before
 * performing any action", which surfaces as Tap to Pay being unavailable and
 * sends whoever debugs it to Apple and Stripe over a missing function call.
 */
function Lifecycle({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  /**
   * `terminal.config` is a `doorProcedure`, so a punter's call is refused
   * server-side and lands here as an error — which is exactly the eligibility
   * answer we want. No second permission model in the app to drift from the
   * server's.
   */
  const config = api.terminal.config.useQuery(undefined, {
    enabled: !!user,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const [state, setState] = useState<TapToPayState>({ status: "preparing" });
  const [justAcceptedTerms, setJustAccepted] = useState(false);
  /**
   * Two counters, not one.
   *
   * `warmNonce` re-runs the whole warm-up — initialize, support check,
   * discovery — and is bumped by an explicit retry or by the app coming back to
   * the foreground. `connectNonce` re-runs only the connect, and is what
   * accepting the terms bumps: the SDK is already up and the reader already
   * discovered by then, so tearing that down and rediscovering would put a
   * needless few seconds between the button and Apple's sheet, and would race
   * `discoverReaders` against an in-flight connect.
   */
  const [warmNonce, setWarmNonce] = useState(0);
  const [connectNonce, setConnectNonce] = useState(0);

  /**
   * Whether the *next* connect may raise Apple's Terms and Conditions sheet.
   *
   * A ref rather than state because it must not itself trigger a render pass —
   * it is read at the moment of connecting, and it is reset immediately after
   * so a background reconnect can never inherit permission granted for one
   * deliberate button press.
   */
  const tosPermitted = useRef(false);
  /** Guards against connecting twice to the same discovered reader. */
  const connectAttempt = useRef<string | null>(null);

  const onProgress = useCallback((progress: string) => {
    const parsed = Number(progress);
    setState({
      status: "configuring",
      progress: Number.isFinite(parsed) ? parsed : null,
    });
  }, []);

  const onStartInstalling = useCallback(() => {
    setState({ status: "configuring", progress: 0 });
  }, []);

  const onFinishInstalling = useCallback(() => {
    setState({ status: "ready" });
  }, []);

  /**
   * Apple told us acceptance happened. This is the signal the education screens
   * hang off (4.2) — and it is a *notification*, not a stored fact: the next
   * launch still asks the SDK rather than trusting this.
   */
  const onAcceptTerms = useCallback(() => {
    setJustAccepted(true);
  }, []);

  const {
    initialize,
    discoverReaders,
    discoveredReaders,
    connectReader,
    connectedReader,
    supportsReadersOfType,
    setTapToPayUxConfiguration,
  } = useStripeTerminal({
    onDidReportReaderSoftwareUpdateProgress: onProgress,
    onDidStartInstallingUpdate: onStartInstalling,
    onDidFinishInstallingUpdate: onFinishInstalling,
    onDidAcceptTermsOfService: onAcceptTerms,
  });

  // The context value is rebuilt every render, so the SDK functions cannot be
  // effect dependencies without re-running the whole warm-up continuously.
  const sdk = useRef({
    initialize,
    discoverReaders,
    connectReader,
    supportsReadersOfType,
    setTapToPayUxConfiguration,
  });
  sdk.current = {
    initialize,
    discoverReaders,
    connectReader,
    supportsReadersOfType,
    setTapToPayUxConfiguration,
  };

  const eligible = config.isSuccess;
  const locationId = config.data?.locationId ?? null;
  const canAcceptTerms = config.data?.canAcceptTerms ?? false;
  const stripeConfigured = config.data?.available ?? false;

  /**
   * Warm-up. Checklist 1.5: at launch, and again whenever the app returns to
   * the foreground.
   */
  useEffect(() => {
    if (config.isPending) return;

    if (!eligible) {
      setState({ status: "ineligible" });
      return;
    }

    if (Platform.OS !== "ios") {
      setState({
        status: "unsupported",
        reason: "platform",
        message: "Tap to Pay on iPhone needs an iPhone.",
      });
      return;
    }

    // Before any SDK call, so an old iOS reports as an old iOS rather than as
    // whatever generic failure the reader happens to raise. Checklist 1.4.
    const version = iosVersion();
    if (version !== null && version < MIN_TAP_TO_PAY_IOS) {
      setState({
        status: "unsupported",
        reason: "os",
        message: `This iPhone is on iOS ${version}. Tap to Pay on iPhone needs iOS ${MIN_TAP_TO_PAY_IOS} or later — update it in Settings › General › Software Update.`,
      });
      return;
    }

    if (!stripeConfigured) {
      setState({
        status: "unsupported",
        reason: "account",
        message: "Card payments aren't set up on the Atmos account yet.",
      });
      return;
    }

    let alive = true;
    setState({ status: "preparing" });

    void (async () => {
      try {
        // Needs the network and a signed-in session, because it fetches a
        // connection token — so failure here is worth retrying, not final.
        const { error: initError } = await sdk.current.initialize();
        if (!alive) return;
        if (initError) {
          setState({ status: "error", message: initError.message });
          return;
        }

        // Apple's payment sheet is a system surface. Ours is forced dark, and a
        // white sheet at a dark door is jarring enough to read as a bug. HIG,
        // checklist 1.8.
        void sdk.current
          .setTapToPayUxConfiguration({
            darkMode: DarkMode.DARK,
            colors: { primary: colors.accent, success: colors.in, error: colors.deny },
          })
          .catch(() => undefined);

        const { readerSupportResult, error: supportError } =
          await sdk.current.supportsReadersOfType({
            deviceType: "tapToPay",
            discoveryMethod: "tapToPay",
            simulated: __DEV__,
          });
        if (!alive) return;

        if (supportError || !readerSupportResult) {
          const described = describeError(supportError);
          setState({
            status: "unsupported",
            reason: described.reason ?? "device",
            message: described.reason
              ? described.message
              : "This iPhone can't take payments with Tap to Pay on iPhone. It needs an iPhone XS or later, and this build has to be signed with Apple's Tap to Pay on iPhone entitlement.",
          });
          return;
        }

        connectAttempt.current = null;
        const { error: discoverError } = await sdk.current.discoverReaders({
          discoveryMethod: "tapToPay",
          simulated: __DEV__,
        });
        if (!alive) return;
        if (discoverError) {
          setState({ status: "error", message: discoverError.message });
        }
      } catch (cause) {
        if (!alive) return;
        setState({
          status: "error",
          message:
            cause instanceof Error
              ? cause.message
              : "Couldn't get Tap to Pay on iPhone ready.",
        });
      }
    })();

    return () => {
      alive = false;
    };
  }, [config.isPending, eligible, stripeConfigured, warmNonce]);

  /**
   * Connect to whatever discovery turned up.
   *
   * The reader is the phone itself, so there is only ever one. Stripe still
   * scopes readers to a Location, which is why a missing one is called out
   * plainly rather than failing deep inside the SDK.
   */
  useEffect(() => {
    if (connectedReader) return;
    if (state.status === "unsupported" || state.status === "ineligible") return;

    const reader = discoveredReaders[0] as Reader.Type | undefined;
    if (!reader) return;

    /**
     * One connect per reader per deliberate attempt.
     *
     * Deliberately *not* keyed on `tosPermitted`: that ref is reset the moment
     * it is read, so including it would change the key between the attempt
     * starting and this effect re-running on the resulting `setState` — and the
     * connect would fire a second time, this time without permission, undoing
     * the acceptance the merchant just tapped through.
     */
    const attemptKey = `${reader.id ?? "reader"}:${connectNonce}`;
    if (connectAttempt.current === attemptKey) return;
    connectAttempt.current = attemptKey;

    if (!locationId) {
      setState({
        status: "error",
        message:
          "No Stripe Terminal location is configured. Set STRIPE_TERMINAL_LOCATION_ID on the server.",
      });
      return;
    }

    const permitted = tosPermitted.current;
    // One deliberate press buys one chance to show Apple's sheet. Reset before
    // awaiting so nothing that runs later inherits it.
    tosPermitted.current = false;

    void (async () => {
      const { error } = await sdk.current.connectReader({
        discoveryMethod: "tapToPay",
        reader,
        locationId,
        merchantDisplayName: "Atmos",
        /**
         * The load-bearing flag, and the reason the warm-up is safe to run at
         * launch. False means "connect if this Apple Account has already
         * accepted, otherwise fail" — so an unaccepted handset never ambushes
         * whoever opened the app with Apple's Terms and Conditions sheet, which
         * would breach 3.5 and 3.8 at once.
         */
        tosAcceptancePermitted: permitted,
        // Comes back by itself after a call, a lock, or a dropped network,
        // instead of making the next sale wait for a fresh connect.
        autoReconnectOnUnexpectedDisconnect: true,
      });

      if (!error) {
        setState({ status: "ready" });
        return;
      }

      const described = describeError(error);
      if (described.reason) {
        setState({
          status: "unsupported",
          reason: described.reason,
          message: described.message,
        });
        return;
      }

      /**
       * A refused connect that we asked to be refused. We cannot tell "terms
       * outstanding" apart from other reader failures by error code — the SDK
       * maps `tapToPayReaderTOSNotYetAccepted` onto the same
       * `READER_SOFTWARE_UPDATE_FAILED` as a real update failure — so the state
       * is named for what is actually known: setup has not completed on this
       * handset, and the way through is the explicit setup action.
       */
      if (!permitted) {
        setState({ status: "needs-setup", canAccept: canAcceptTerms });
        return;
      }

      setState({ status: "error", message: described.message });
    })();
  }, [
    connectedReader,
    discoveredReaders,
    locationId,
    canAcceptTerms,
    connectNonce,
    state.status,
  ]);

  /** A live connection is the only thing that means "ready". */
  useEffect(() => {
    if (!connectedReader) return;
    setState((current) =>
      current.status === "configuring" ? current : { status: "ready" },
    );
  }, [connectedReader]);

  // Checklist 1.5 — "or when it comes to the foreground". Only when there is
  // nothing attached: `autoReconnectOnUnexpectedDisconnect` already handles a
  // reader that merely dropped, and re-running discovery over the top of it
  // would be slower than leaving it alone.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      if (connectedReader) return;
      setWarmNonce((value) => value + 1);
    });
    return () => subscription.remove();
  }, [connectedReader]);

  const acceptTerms = useCallback(async () => {
    if (!canAcceptTerms) {
      throw new Error(
        "Only an Atmos admin can accept the Tap to Pay on iPhone Terms and Conditions.",
      );
    }
    tosPermitted.current = true;
    connectAttempt.current = null;
    setState({ status: "preparing" });
    // Connect only. The SDK is up and the reader is discovered already.
    setConnectNonce((value) => value + 1);
  }, [canAcceptTerms]);

  const retry = useCallback(() => {
    connectAttempt.current = null;
    setWarmNonce((value) => value + 1);
    setConnectNonce((value) => value + 1);
  }, []);

  const acknowledgeAcceptance = useCallback(() => setJustAccepted(false), []);

  const value = useMemo<TapToPayContextValue>(
    () => ({
      state,
      isReady: state.status === "ready" && !!connectedReader,
      acceptTerms,
      retry,
      justAcceptedTerms,
      acknowledgeAcceptance,
    }),
    [
      state,
      connectedReader,
      acceptTerms,
      retry,
      justAcceptedTerms,
      acknowledgeAcceptance,
    ],
  );

  return (
    <TapToPayContext.Provider value={value}>{children}</TapToPayContext.Provider>
  );
}

/**
 * Mounted at the root rather than around the door stack.
 *
 * Checklist 1.5 asks for warm-up at app launch, which cannot happen from a
 * provider that only mounts once somebody has already navigated into door mode.
 * Mounting the Stripe provider costs nothing on its own — it initializes
 * nothing until asked — and `Lifecycle` refuses to ask unless the server says
 * this account is door staff.
 */
export function TapToPayProvider({ children }: { children: ReactNode }) {
  const connectionToken = api.terminal.connectionToken.useMutation();

  return (
    <StripeTerminalProvider
      logLevel="error"
      tokenProvider={async () => {
        // Minted server-side against the secret key, which is what stops a
        // decompiled app acting as a reader on this account.
        const { secret } = await connectionToken.mutateAsync();
        return secret;
      }}
    >
      <Lifecycle>{children}</Lifecycle>
    </StripeTerminalProvider>
  );
}

/**
 * Copy for the states that several screens have to render identically.
 *
 * The product is called "Tap to Pay on iPhone" in every one of these, and in
 * every other user-facing string in the app. Apple's Developer Marketing
 * Guidelines do not allow it shortened — not to "Tap to Pay", and not to
 * "Tap" — and checklist row 1.9 is checked against exactly this. It reads long
 * in a headline; that is the trade.
 */
export function tapToPayHeadline(state: TapToPayState): string {
  switch (state.status) {
    case "ready":
      return "Ready to take payments";
    case "configuring":
      return "Setting up Tap to Pay on iPhone";
    case "preparing":
      return "Getting Tap to Pay on iPhone ready";
    case "needs-setup":
      return "Tap to Pay on iPhone isn't set up yet";
    case "unsupported":
      return "Tap to Pay on iPhone unavailable";
    case "error":
      return "Tap to Pay on iPhone had a problem";
    case "ineligible":
      return "Tap to Pay on iPhone is for Atmos door staff";
  }
}
