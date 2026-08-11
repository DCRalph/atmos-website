"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CameraOff, FlashlightIcon, RefreshCw } from "lucide-react";

import { Button } from "~/components/ui/button";

/**
 * Camera QR scanning.
 *
 * `qr-scanner` is used rather than the native `BarcodeDetector` because Safari
 * on iOS still doesn't ship it, and half the phones on any given door are
 * iPhones. The library uses `BarcodeDetector` under the hood where it exists
 * and falls back to a wasm worker where it doesn't, so this gets the fast path
 * on Android without leaving iOS staff typing ticket numbers all night.
 *
 * The module is imported dynamically: it touches `window` at module scope and
 * would break server rendering.
 */

/** Ignore repeats of the same code for this long, so one badge isn't scanned 8 times. */
const REPEAT_SUPPRESSION_MS = 3500;

type QrScannerInstance = {
  start: () => Promise<void>;
  stop: () => void;
  destroy: () => void;
  setCamera: (facingMode: "environment" | "user") => Promise<void>;
  hasFlash: () => Promise<boolean>;
  toggleFlash: () => Promise<void>;
};

export function CameraScanner({
  onScan,
  paused,
}: {
  onScan: (token: string) => void;
  /** Freezes decoding while a result is on screen. */
  paused: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScannerInstance | null>(null);
  const lastScanRef = useRef<{ token: string; at: number } | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const [error, setError] = useState<string | null>(null);
  const [hasFlash, setHasFlash] = useState(false);
  const [ready, setReady] = useState(false);

  const handleDecode = useCallback(
    (token: string) => {
      if (pausedRef.current) return;

      const previous = lastScanRef.current;
      const now = Date.now();
      if (
        previous?.token === token &&
        now - previous.at < REPEAT_SUPPRESSION_MS
      ) {
        return;
      }
      lastScanRef.current = { token, at: now };
      onScan(token);
    },
    [onScan],
  );

  useEffect(() => {
    let cancelled = false;
    let instance: QrScannerInstance | null = null;

    async function boot() {
      const video = videoRef.current;
      if (!video) return;

      try {
        const { default: QrScanner } = await import("qr-scanner");
        if (cancelled) return;

        instance = new QrScanner(
          video,
          (result: { data: string }) => handleDecode(result.data),
          {
            preferredCamera: "environment",
            highlightScanRegion: true,
            highlightCodeOutline: true,
            // A door is a fixed distance; a smaller scan region decodes faster.
            maxScansPerSecond: 8,
            returnDetailedScanResult: true,
          },
        );

        scannerRef.current = instance;
        await instance.start();
        if (cancelled) return;

        setReady(true);
        setHasFlash(await instance.hasFlash().catch(() => false));
      } catch (cause) {
        if (cancelled) return;
        setError(
          cause instanceof Error && cause.name === "NotAllowedError"
            ? "Camera access was blocked. Allow it in your browser settings, then reload."
            : "Couldn't start the camera. Use manual entry below.",
        );
      }
    }

    void boot();

    return () => {
      cancelled = true;
      instance?.destroy();
      scannerRef.current = null;
    };
  }, [handleDecode]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 border-2 border-white/10 bg-black p-8 text-center">
        <CameraOff className="size-8 text-white/40" aria-hidden />
        <p className="text-sm text-white/60">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden border-2 border-white/10 bg-black">
      <video
        ref={videoRef}
        className="aspect-square w-full object-cover"
        playsInline
        muted
      />

      {!ready && (
        <div className="absolute inset-0 grid place-items-center bg-black/80 text-sm text-white/50">
          Starting camera…
        </div>
      )}

      <div className="absolute right-3 bottom-3 flex gap-2">
        {hasFlash && (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            aria-label="Toggle torch"
            onClick={() => void scannerRef.current?.toggleFlash()}
          >
            <FlashlightIcon className="size-4" />
          </Button>
        )}
        <Button
          type="button"
          size="icon"
          variant="secondary"
          aria-label="Switch camera"
          onClick={() => void scannerRef.current?.setCamera("user")}
        >
          <RefreshCw className="size-4" />
        </Button>
      </div>
    </div>
  );
}
