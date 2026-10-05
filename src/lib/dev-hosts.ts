import { env } from "~/env";

/**
 * Extra names `next dev` is opened on besides localhost (Tailscale, LAN), from
 * `DEV_ORIGINS`, e.g. `my-box,my-box.tailnet.ts.net,*.tailnet.ts.net`.
 * next.config.js lets them load dev assets; `src/proxy.ts` treats them as the
 * main site and auth trusts them as origins. Always empty outside development.
 */
export const DEV_HOSTS: readonly string[] =
  env.NODE_ENV === "development"
    ? (env.DEV_ORIGINS?.split(",")
        .map((host) => host.trim())
        .filter(Boolean) ?? [])
    : [];
