const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** Accepts a video ID or a YouTube watch, share, Shorts, live or embed URL. */
export function getYouTubeId(value: string | null | undefined): string | null {
  const input = value?.trim();
  if (!input) return null;
  if (VIDEO_ID.test(input)) return input;

  try {
    const url = new URL(
      /^https?:\/\//i.test(input) ? input : `https://${input}`,
    );
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.replace(/^(www\.|m\.)/, "");
    const parts = url.pathname.split("/").filter(Boolean);
    const candidate =
      host === "youtu.be"
        ? parts[0]
        : host === "youtube.com" || host === "youtube-nocookie.com"
          ? url.pathname === "/watch"
            ? url.searchParams.get("v")
            : ["embed", "shorts", "live", "v"].includes(parts[0] ?? "")
              ? parts[1]
              : null
          : null;
    return candidate && VIDEO_ID.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

export function youtubeThumbnail(videoId: string) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
