"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CameraOff,
  FlashlightIcon,
  RefreshCw,
  SwitchCamera,
} from "lucide-react";

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
 *
 * The camera is started exactly once and then left alone. It used to be torn
 * down and rebuilt whenever `onScan` changed identity — which is every time the
 * scan mutation changes state, so once per scan — and re-acquiring a camera
 * stream is slow, flickers, and sometimes just doesn't come back. Nothing in
 * here may depend on a prop that changes per render; the callback is read
 * through a ref instead.
 */

/** Ignore repeats of the same code for this long, so one badge isn't scanned 8 times. */
const REPEAT_SUPPRESSION_MS = 3500;

/**
 * How long the just-dismissed code stays ignored after a result clears.
 *
 * The phone is still pointed at the same ticket when staff tap Next — they
 * haven't moved yet — so without this the code is read again immediately and
 * the result screen appears never to have closed. Measured from the dismissal
 * rather than the decode, because staff now take as long as they like reading
 * a result and any window measured from the scan has long since lapsed.
 */
const POST_DISMISS_SUPPRESSION_MS = 2500;

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
  const lastScanRef = useRef<{
    token: string;
    at: number;
    suppressFor: number;
  } | null>(null);

  // Read through refs so the boot effect below never has to re-run.
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const [error, setError] = useState<string | null>(null);
  const [hasFlash, setHasFlash] = useState(false);
  const [ready, setReady] = useState(false);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [attempt, setAttempt] = useState(0);

  // Restart the suppression window when a result clears, rather than letting
  // it run from the original decode.
  const wasPausedRef = useRef(paused);
  useEffect(() => {
    const previous = lastScanRef.current;
    if (wasPausedRef.current && !paused && previous) {
      lastScanRef.current = {
        ...previous,
        at: Date.now(),
        suppressFor: POST_DISMISS_SUPPRESSION_MS,
      };
    }
    wasPausedRef.current = paused;
  }, [paused]);

  const restart = useCallback(() => {
    setError(null);
    setReady(false);
    setAttempt((value) => value + 1);
  }, []);

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
          (result: { data: string }) => {
            if (pausedRef.current) return;

            const previous = lastScanRef.current;
            const now = Date.now();
            if (
              previous?.token === result.data &&
              now - previous.at < previous.suppressFor
            ) {
              return;
            }
            lastScanRef.current = {
              token: result.data,
              at: now,
              suppressFor: REPEAT_SUPPRESSION_MS,
            };
            onScanRef.current(result.data);
          },
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
            : "Couldn't start the camera.",
        );
      }
    }

    void boot();

    return () => {
      cancelled = true;
      instance?.destroy();
      scannerRef.current = null;
    };
    // `attempt` is the restart handle; nothing else may retrigger this.
  }, [attempt]);

  // iOS suspends the capture when the browser goes to the background and does
  // not always resume it on return, which is how a phone comes out of a pocket
  // showing a frozen frame.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      const video = videoRef.current;
      if (video && video.readyState === 0) restart();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [restart]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 border-2 border-white/10 bg-black p-8 text-center">
        <CameraOff className="size-8 text-white/40" aria-hidden />
        <p className="text-sm text-white/60">{error}</p>
        <Button type="button" variant="secondary" onClick={restart}>
          <RefreshCw className="size-4" aria-hidden />
          Restart camera
        </Button>
        <p className="text-xs text-white/40">
          Manual entry and the door list still work.
        </p>
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
          onClick={() => {
            const next = facing === "environment" ? "user" : "environment";
            setFacing(next);
            void scannerRef.current?.setCamera(next);
          }}
        >
          <SwitchCamera className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="secondary"
          aria-label="Restart camera"
          onClick={restart}
        >
          <RefreshCw className="size-4" />
        </Button>
      </div>
    </div>
  );
}
