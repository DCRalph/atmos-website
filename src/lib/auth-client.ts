import { createAuthClient } from "better-auth/react";
import { type BetterAuthClientPlugin } from "better-auth/client";
import {
  genericOAuthClient,
  lastLoginMethodClient,
} from "better-auth/client/plugins";
import type { impersonation } from "~/server/impersonation";

export const authClient = createAuthClient({
  plugins: [
    lastLoginMethodClient(),
    genericOAuthClient(),
    {
      id: "impersonation",
      $InferServerPlugin: {} as ReturnType<typeof impersonation>,
    } satisfies BetterAuthClientPlugin,
  ],
});
