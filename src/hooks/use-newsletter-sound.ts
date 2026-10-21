"use client";

import { useEffect, useRef } from "react";

/** Unlock audio in the submit gesture, then play the original sound on success. */
export function useNewsletterSound() {
  const file = useRef<Promise<ArrayBuffer | null> | null>(null);
  const audio = useRef<{
    context: AudioContext;
    buffer: Promise<AudioBuffer | null>;
    unlocked: Promise<void>;
  } | null>(null);

  const load = () => {
    file.current ??= fetch("/subscribe.mp3")
      .then((response) => (response.ok ? response.arrayBuffer() : null))
      .catch(() => null);
    return file.current;
  };

  useEffect(() => {
    void load();
    return () => {
      const context = audio.current?.context;
      if (context && context.state !== "closed")
        void context.close().catch(() => undefined);
    };
  }, []);

  const prepare = () => {
    try {
      if (!audio.current || audio.current.context.state === "closed") {
        const context = new AudioContext();
        audio.current = {
          context,
          buffer: load()
            .then((bytes) =>
              bytes ? context.decodeAudioData(bytes.slice(0)) : null,
            )
            .catch(() => null),
          unlocked: Promise.resolve(),
        };
      }
      // This must happen before awaiting the subscription request, especially on iOS.
      audio.current.unlocked = audio.current.context
        .resume()
        .catch(() => undefined);
    } catch {
      // Audio is optional; a device without it can still subscribe.
    }
  };

  const play = async () => {
    const prepared = audio.current;
    if (!prepared) return;
    try {
      await prepared.unlocked;
      const buffer = await prepared.buffer;
      if (!buffer || prepared.context.state !== "running") return;
      const source = prepared.context.createBufferSource();
      const gain = prepared.context.createGain();
      source.buffer = buffer;
      gain.gain.value = 0.6;
      source.connect(gain).connect(prepared.context.destination);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
      };
      source.start();
    } catch {
      // An unavailable output device must not turn a successful signup into an error.
    }
  };

  return { prepare, play };
}
