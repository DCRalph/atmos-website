import { env } from "~/env";
import { PRIVATE_NETWORK_HOSTS } from "./private-network-hosts";

/**
 * Extra names `next dev` is opened on besides localhost: any private network
 * address (`PRIVATE_NETWORK_HOSTS`), plus whatever `DEV_ORIGINS` lists, e.g.
 * `my-box,my-box.tailnet.ts.net,*.tailnet.ts.net`. next.config.js lets them
 * load dev assets; `src/proxy.ts` treats them as the main site and auth
 * trusts them as origins. Always empty outside development.
 */
export const DEV_HOSTS: readonly string[] =
  env.NODE_ENV === "development"
    ? [
        ...PRIVATE_NETWORK_HOSTS,
        ...(env.DEV_ORIGINS?.split(",")
          .map((host) => host.trim())
          .filter(Boolean) ?? []),
      ]
    : [];
