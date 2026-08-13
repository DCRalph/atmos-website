import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  StripeTerminalProvider,
  useStripeTerminal,
} from "@stripe/stripe-terminal-react-native";

import { api } from "@/lib/api";

/**
 * Bringing the Terminal SDK up.
 *
 * `StripeTerminalProvider` does not do this itself. It hands `initialize` out
 * through context and waits to be asked; until something asks, every other SDK
 * call fails with "First initialize the Stripe Terminal SDK before performing
 * any action" — which surfaces at the door as Tap to Pay being unavailable,
 * pointing at Apple and Stripe rather than at a missing call.
 *
 * The provider's own `isInitialized` cannot be used to wait on: it is a ref
 * read inside a `useMemo`, so setting it never re-renders anyone. Hence the
 * state here.
 *
 * Initialization also fetches a connection token, so it needs the network and
 * a signed-in session. That makes failure worth retrying rather than final.
 */
type InitState =
  | { status: "pending" }
  | { status: "ready" }
  | { status: "error"; message: string };

const TerminalInitContext = createContext<InitState & { retry: () => void }>({
  status: "pending",
  retry: () => {},
});

export const useTerminalInit = () => useContext(TerminalInitContext);

function Bootstrap({ children }: { children: ReactNode }) {
  const { initialize } = useStripeTerminal();
  const [state, setState] = useState<InitState>({ status: "pending" });

  // `initialize` is rebuilt whenever the token provider closure changes, which
  // is every render. Without this the effect would loop.
  const started = useRef(false);
  const initializeRef = useRef(initialize);
  initializeRef.current = initialize;

  const start = useCallback(async () => {
    setState({ status: "pending" });
    try {
      const { error } = await initializeRef.current();
      setState(
        error
          ? { status: "error", message: error.message }
          : { status: "ready" },
      );
    } catch (cause) {
      setState({
        status: "error",
        message:
          cause instanceof Error
            ? cause.message
            : "Couldn't start the card reader.",
      });
    }
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void start();
  }, [start]);

  return (
    <TerminalInitContext.Provider value={{ ...state, retry: () => void start() }}>
      {children}
    </TerminalInitContext.Provider>
  );
}

/**
 * Wraps the whole door stack rather than the sell screen, so the reader stays
 * connected between sales; reconnecting per transaction adds seconds to every
 * tap.
 */
export function DoorTerminalProvider({ children }: { children: ReactNode }) {
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
      <Bootstrap>{children}</Bootstrap>
    </StripeTerminalProvider>
  );
}
