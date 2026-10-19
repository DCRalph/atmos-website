export const experiences = [
  {
    id: "soundwave",
    label: "A. Soundwave",
    description:
      "Five seconds of heartbeats, soundwaves and confetti, landing on your own thank-you page.",
    headline: "You keep the night going.",
  },
  {
    id: "supporter-pass",
    label: "B. Supporter pass",
    description:
      "Your pass slides out, catches the light and gets a big-love stamp before your thank-you page opens.",
    headline: "This one’s got a little of you in it.",
  },
  {
    id: "encore",
    label: "C. Encore",
    description:
      "The curtains open, the lights sweep and the love comes down. Then a whole new page, just for you.",
    headline: "From all of us to you.",
  },
  {
    id: "basic",
    label: "D. One second",
    description:
      "A one-second celebration in the current layout: a heart pop, a small burst of green, then your thank-you and sharing.",
    headline: "Thank you",
  },
] as const;

export type ExperienceId = (typeof experiences)[number]["id"];
export const CELEBRATION_MS = 5_000;
export const sampleAmounts = [500, 1500, 2500, 5000];
