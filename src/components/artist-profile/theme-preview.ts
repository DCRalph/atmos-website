import { zArtistTheme, type ArtistTheme } from "~/lib/artist-theme";

/**
 * Live theme previews. The theme editor shows a profile in an iframe and
 * pushes unsaved themes into it by `postMessage`, so every change shows
 * instantly without a reload. The frame says it's ready once mounted; the
 * editor answers with the current theme, then sends each change.
 */
export type ThemePreviewMessage =
  | { type: "artist-theme-preview:ready" }
  | { type: "artist-theme-preview:theme"; theme: ArtistTheme };

/** Read a preview message, or null for anything else (other origins, other apps). */
export function readPreviewMessage(
  event: MessageEvent<unknown>,
): ThemePreviewMessage | null {
  if (event.origin !== window.location.origin) return null;
  const data = event.data;
  if (!data || typeof data !== "object" || !("type" in data)) return null;
  if (data.type === "artist-theme-preview:ready") return { type: data.type };
  if (data.type === "artist-theme-preview:theme" && "theme" in data) {
    const theme = zArtistTheme.safeParse(data.theme);
    return theme.success ? { type: data.type, theme: theme.data } : null;
  }
  return null;
}

export function postPreviewMessage(
  target: Window | null | undefined,
  message: ThemePreviewMessage,
) {
  target?.postMessage(message, window.location.origin);
}
