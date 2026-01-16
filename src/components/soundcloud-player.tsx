import * as React from "react";

import { cn } from "~/lib/utils";

type SoundCloudWidgetParams = {
  auto_play?: boolean;
  color?: string; // hex, e.g. "#0066CC"
  buying?: boolean;
  sharing?: boolean;
  visual?: boolean;
  download?: boolean;
  show_artwork?: boolean;
  show_playcount?: boolean;
  show_user?: boolean;
  start_track?: number; // 0..playlist length
  single_active?: boolean;
};

export type SoundCloudPlayerProps = {
  /**
   * SoundCloud URL for the widget `url` parameter.
   * Can be a SoundCloud API URL (recommended by docs) like:
   * - `https://api.soundcloud.com/tracks/293`
   * - `https://api.soundcloud.com/playlists/123`
   * or a normal SoundCloud URL; the widget will resolve it.
   */
  url: string;
  /** Height of the player iframe (default 166). */
  size?: "small" | "default" | "square";
  /** Widget API parameters, appended to the iframe src. */
  params?: SoundCloudWidgetParams;
  className?: string;
  title?: string;
};

function toWidgetQuery(params: SoundCloudWidgetParams | undefined) {
  if (!params) return "";

  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (typeof value === "boolean") q.set(key, value ? "true" : "false");
    else q.set(key, String(value));
  }
  return q.toString();
}

export function SoundCloudPlayer({
  url,
  size = "default",
  params,
  className,
  title = "SoundCloud player",
}: SoundCloudPlayerProps) {
  const { heightValue, widthValue, resolvedParams } = React.useMemo(() => {
    if (size === "small") {
      return { heightValue: 120, widthValue: "100%", resolvedParams: params };
    }
    if (size === "square") {
      return {
        heightValue: 450,
        widthValue: "100%",
        resolvedParams: { ...params, visual: true },
      };
    }
    return { heightValue: 166, widthValue: "100%", resolvedParams: params };
  }, [params, size]);

  const src = React.useMemo(() => {
    const base = "https://w.soundcloud.com/player/?url=";
    const urlEncoded = encodeURIComponent(url);

    const extra = toWidgetQuery(resolvedParams);

    const full = extra ? `${urlEncoded}&${extra}` : urlEncoded;

    return `${base}${full}`;
  }, [resolvedParams, url]);

  return (
    <iframe
      title={title}
      width={String(widthValue)}
      height={String(heightValue)}
      loading="lazy"
      allow="autoplay"
      src={src}
      className={cn("block w-full", className)}
    />
  );
}
