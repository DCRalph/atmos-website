import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, loggerLink } from "@trpc/client";
import SuperJSON from "superjson";

import { api } from "@/lib/api";
import { authCookieHeader } from "@/lib/auth";
import { TRPC_URL } from "@/lib/env";
import { usePushRegistration } from "@/lib/push";
import { useRunSheetLiveActivity } from "@/lib/live-activity";
import { BiometricLockProvider } from "@/lib/biometrics";
import { TapToPayProvider } from "@/lib/tap-to-pay";
import { TapToPaySplash } from "@/components/tap-to-pay-splash";

/**
 * `httpBatchLink`, not the streaming link the website uses: React Native's
 * fetch does not expose a readable stream body, so a streamed response would
 * arrive only once complete anyway — with the extra failure modes for free.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            retry: 2,
            // A phone changes network constantly; refetching when it comes
            // back is the difference between fresh data and a stale door list.
            refetchOnReconnect: true,
          },
        },
      }),
  );

  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        loggerLink({
          enabled: (op) =>
            __DEV__ || (op.direction === "down" && op.result instanceof Error),
        }),
        httpBatchLink({
          url: TRPC_URL,
          transformer: SuperJSON,
          headers() {
            return {
              "x-trpc-source": "expo",
              // The session lives in SecureStore, not a browser cookie jar,
              // so it has to be attached by hand on every call.
              Cookie: authCookieHeader(),
            };
          },
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        {/* Inside the tRPC provider, since registering calls the API. */}
        <PushRegistration />
        {/* At the root rather than on the run sheet screen: the lock screen is
            for the hours somebody is *not* looking at the app, so it has to go
            up whenever they open it during a night, not only if they happen to
            visit that tab. Inert for anybody with no run sheet. */}
        <RunSheetLiveActivity />
        {/* Also inside it, and at the root rather than around the door stack:
            Apple's checklist 1.5 wants Tap to Pay warmed up at app launch, and
            a provider that mounts when somebody enters door mode is already too
            late. It stays inert for anybody the server does not recognise as
            door staff. */}
        <TapToPayProvider>
          {/* Outermost of the UI layers, so its lock screen covers the splash
              as well as the app. Checklist 1.7. */}
          <BiometricLockProvider>
            {children}
            {/* Checklist 3.2 and 6.2 — shown once to every eligible user, over
                whatever they happened to open the app on. Renders nothing at
                all for anybody the server does not recognise as door staff. */}
            <TapToPaySplash />
          </BiometricLockProvider>
        </TapToPayProvider>
      </api.Provider>
    </QueryClientProvider>
  );
}

/** Renders nothing; exists so the hook sits under the providers it needs. */
function PushRegistration() {
  usePushRegistration();
  return null;
}

/** Likewise: it queries the run sheet, so it lives under tRPC. */
function RunSheetLiveActivity() {
  useRunSheetLiveActivity();
  return null;
}
