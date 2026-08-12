import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, loggerLink } from "@trpc/client";
import SuperJSON from "superjson";

import { api } from "@/lib/api";
import { authCookieHeader } from "@/lib/auth";
import { TRPC_URL } from "@/lib/env";
import { usePushRegistration } from "@/lib/push";

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
        {children}
      </api.Provider>
    </QueryClientProvider>
  );
}

/** Renders nothing; exists so the hook sits under the providers it needs. */
function PushRegistration() {
  usePushRegistration();
  return null;
}
