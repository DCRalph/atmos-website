"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Monitor, Smartphone } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import type { ArtistTheme } from "~/lib/artist-theme";
import {
  postPreviewMessage,
  readPreviewMessage,
} from "~/components/artist-profile/theme-preview";

const DESKTOP = { width: 1440, height: 1000 };
const PHONE = { width: 390, height: 780 };

/**
 * A live artist profile inside the editors. Desktop renders at full desktop
 * width, scaled down to fit, so the real desktop layout shows rather than the
 * tablet one; phone renders at phone width. When `theme` is passed it's
 * pushed into the page on every change (no reload); `reloadKey` reloads the
 * page, for content saved elsewhere.
 */
export function ProfilePreviewFrame({
  src,
  theme,
  reloadKey,
  label,
}: {
  src: string;
  theme?: ArtistTheme;
  reloadKey?: string | number;
  label: string;
}) {
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const frameRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(0);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(([entry]) =>
      setBoxWidth(entry?.contentRect.width ?? 0),
    );
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!theme) return;
    const send = () =>
      postPreviewMessage(frameRef.current?.contentWindow, {
        type: "artist-theme-preview:theme",
        theme,
      });
    send();
    const onMessage = (e: MessageEvent<unknown>) => {
      if (readPreviewMessage(e)?.type === "artist-theme-preview:ready") send();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [theme]);

  const size = device === "desktop" ? DESKTOP : PHONE;
  const scale =
    device === "desktop" && boxWidth ? Math.min(1, boxWidth / size.width) : 1;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground truncate text-xs">{label}</p>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant={device === "desktop" ? "secondary" : "ghost"}
            onClick={() => setDevice("desktop")}
            aria-pressed={device === "desktop"}
          >
            <Monitor className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only sm:ml-1.5">Desktop</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant={device === "phone" ? "secondary" : "ghost"}
            onClick={() => setDevice("phone")}
            aria-pressed={device === "phone"}
          >
            <Smartphone className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only sm:ml-1.5">Phone</span>
          </Button>
          <Button type="button" size="sm" variant="ghost" asChild>
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              aria-label="Open preview in a new tab"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>
      <div
        ref={boxRef}
        className={cn(
          "overflow-hidden rounded-md border bg-black",
          device === "phone" && "bg-muted/40 flex justify-center py-4",
        )}
        style={
          device === "desktop"
            ? { height: Math.round(size.height * scale) }
            : undefined
        }
      >
        <iframe
          key={`${src}-${reloadKey ?? ""}`}
          ref={frameRef}
          title={label}
          src={src}
          className={cn(
            "block bg-black",
            device === "phone" && "rounded-[28px] border-[6px] border-black",
          )}
          style={{
            width: size.width,
            height: size.height,
            transform: scale < 1 ? `scale(${scale})` : undefined,
            transformOrigin: "top left",
          }}
        />
      </div>
    </div>
  );
}
