import { createAuthClient } from "better-auth/react";
import { type BetterAuthClientPlugin } from "better-auth/client";
import { lastLoginMethodClient } from "better-auth/client/plugins";
import type { impersonation } from "~/server/impersonation";

export const authClient = createAuthClient({
  plugins: [
    lastLoginMethodClient(),
    {
      id: "impersonation",
      $InferServerPlugin: {} as ReturnType<typeof impersonation>,
    } satisfies BetterAuthClientPlugin,
  ],
});
