/**
 * Private network addresses `next dev` answers on without being listed in
 * `DEV_ORIGINS`: a phone on the same Wi-Fi (10.x, 172.x, 192.168.x) or over
 * Tailscale (100.x). Routers and Tailscale hand out new addresses, so a fixed
 * list goes stale. Written in Next's `allowedDevOrigins` form, where `*` is
 * one part of the address. Read by next.config.js and `~/lib/dev-hosts`, and
 * only ever applied in development.
 */
export const PRIVATE_NETWORK_HOSTS = [
  "10.*.*.*",
  "172.*.*.*",
  "192.168.*.*",
  "100.*.*.*",
];
