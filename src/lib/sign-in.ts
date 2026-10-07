/**
 * How sign-in methods and sessions are described to people, shared by the
 * admin's user page and the user's own account page.
 */

/** Provider ids as better-auth stores them on `account.providerId`. */
const PROVIDER_LABELS: Record<string, string> = {
  credential: "Password",
  google: "Google",
  apple: "Apple",
};

export function providerLabel(providerId: string): string {
  return (
    PROVIDER_LABELS[providerId] ??
    providerId
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  );
}

/**
 * "Safari on iPhone" from a user agent string. Good enough to tell your own
 * devices apart; the full string is still shown on hover.
 */
export function describeUserAgent(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";
  // Atmos app sends an Expo user agent before it sends a browser's.
  if (/expo|okhttp|cfnetwork/i.test(userAgent)) return "Atmos app";

  const device = /iphone/i.test(userAgent)
    ? "iPhone"
    : /ipad/i.test(userAgent)
      ? "iPad"
      : /android/i.test(userAgent)
        ? "Android"
        : /mac os/i.test(userAgent)
          ? "macOS"
          : /windows/i.test(userAgent)
            ? "Windows"
            : /linux/i.test(userAgent)
              ? "Linux"
              : null;

  const browser = /edg\//i.test(userAgent)
    ? "Edge"
    : /firefox\//i.test(userAgent)
      ? "Firefox"
      : /chrome\//i.test(userAgent)
        ? "Chrome"
        : /safari\//i.test(userAgent)
          ? "Safari"
          : null;

  if (browser && device) return `${browser} on ${device}`;
  return browser ?? device ?? "Unknown device";
}
