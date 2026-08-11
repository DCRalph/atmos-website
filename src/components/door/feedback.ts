"use client";

/**
 * Sound and haptics for the door.
 *
 * A venue is loud and dark, and staff are looking at the person, not the
 * phone. The tone is what actually communicates the result, so each outcome
 * gets a distinct one: a short high blip for "in", a low double buzz for
 * "already scanned", a long harsh tone for "no".
 *
 * Synthesised with WebAudio rather than shipped as audio files — no assets to
 * load over a venue's terrible wifi, and no autoplay policy problems once the
 * context has been unlocked by the first tap.
 */

type Tone = { frequency: number; durationMs: number; gap?: number };

const TONES: Record<"success" | "warn" | "error", Tone[]> = {
  success: [{ frequency: 880, durationMs: 120 }],
  warn: [
    { frequency: 300, durationMs: 130, gap: 80 },
    { frequency: 300, durationMs: 130 },
  ],
  error: [{ frequency: 160, durationMs: 420 }],
};

const VIBRATION: Record<"success" | "warn" | "error", number[]> = {
  success: [40],
  warn: [80, 60, 80],
  error: [300],
};

let audioContext: AudioContext | null = null;

/**
 * Browsers refuse to make noise until the user has interacted. Call this from
 * the first tap on the scanner screen so the very first scan is audible.
 */
export function unlockAudio(): void {
  audioContext ??= new AudioContext();
  if (audioContext.state === "suspended") {
    void audioContext.resume();
  }
}

export function playFeedback(kind: "success" | "warn" | "error"): void {
  if (typeof window === "undefined") return;

  if (typeof navigator.vibrate === "function") {
    navigator.vibrate(VIBRATION[kind]);
  }

  try {
    audioContext ??= new AudioContext();
    const context = audioContext;
    if (context.state === "suspended") void context.resume();

    let offset = 0;
    for (const tone of TONES[kind]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "square";
      oscillator.frequency.value = tone.frequency;

      // A tiny ramp instead of a hard stop — a square wave cut dead clicks.
      const startAt = context.currentTime + offset / 1000;
      const endAt = startAt + tone.durationMs / 1000;
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.25, startAt + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

      oscillator.connect(gain).connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(endAt);

      offset += tone.durationMs + (tone.gap ?? 0);
    }
  } catch {
    // Sound is a nicety; a browser that refuses must not break scanning.
  }
}
