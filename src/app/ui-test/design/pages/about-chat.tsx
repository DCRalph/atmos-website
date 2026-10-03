"use client";

import { motion } from "motion/react";
import { cn } from "~/lib/utils";

// The real "atmos crew" group chat from the current about page.
export const chatMessages = [
  { text: "bro where are you tonight", from: "them" },
  { text: "nothing on why", from: "you" },
  {
    text: "atmos is doing a thing in that old warehouse on tory",
    from: "them",
  },
  { text: "the one that's been empty for ages?", from: "you" },
  { text: "yeah they've completely transformed it", from: "them" },
  {
    text: "last time was unreal. the sound system was insane and the lights were something else",
    from: "them",
  },
  { text: "idk man i'm pretty cooked from the week", from: "you" },
  { text: "that's literally the point", from: "them" },
  { text: "you walk in and everything else just switches off", from: "them" },
  { text: "say less. what time", from: "you" },
  { text: "doors at 10. don't be late", from: "them" },
] as const satisfies readonly { text: string; from: "them" | "you" }[];

type Sender = (typeof chatMessages)[number]["from"];

/** Three still dots in a bubble. Deliberately not animated. */
function TypingBubble({ from }: { from: Sender }) {
  const you = from === "you";
  return (
    <li aria-label="Typing" className={cn("mt-3 flex", you && "justify-end")}>
      <span
        className={cn(
          "flex h-9 items-center gap-1 rounded-[var(--mx-r-panel)] px-4",
          you
            ? "rounded-br-none bg-[var(--mx-accent)] text-[var(--mx-accent-ink)]"
            : "rounded-bl-none bg-white/10 text-white",
        )}
      >
        {[0.35, 0.6, 0.9].map((o) => (
          <span
            key={o}
            className="size-1.5 rounded-full bg-current"
            style={{ opacity: o }}
          />
        ))}
      </span>
    </li>
  );
}

/**
 * The group chat, restyled: notched 16px bubbles (the notch points at the
 * sender), accent for "you", no phone chrome. `count` limits how many
 * messages show, for scroll playback; `typing` adds a still typing bubble
 * for whoever speaks next. `fixedHeight` pins the thread so playback
 * doesn't shift the layout.
 */
export function GroupChat({
  count = chatMessages.length,
  typing = false,
  animate = false,
  fixedHeight = false,
  className,
}: {
  count?: number;
  typing?: boolean;
  animate?: boolean;
  fixedHeight?: boolean;
  className?: string;
}) {
  const shown = chatMessages.slice(0, count);
  const next = chatMessages[count];

  return (
    <figure className={cn("w-full", className)}>
      <figcaption className="flex items-baseline justify-between gap-4 border-b border-white/10 pb-3">
        <span className="mx-label text-[12px]">atmos crew</span>
        <span className="text-[13px] text-white/60">Group chat</span>
      </figcaption>
      <ol
        aria-live={animate ? "polite" : undefined}
        className={cn(
          "flex flex-col pt-4",
          fixedHeight && "h-[min(52svh,440px)] justify-end overflow-hidden",
        )}
      >
        {shown.map((m, i) => {
          const you = m.from === "you";
          const prev = shown[i - 1];
          const after = shown[i + 1] ?? (typing ? next : undefined);
          const lastOfGroup = after?.from !== m.from;
          return (
            <motion.li
              key={m.text}
              initial={animate ? { opacity: 0, y: 10 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className={cn(
                "flex",
                you && "justify-end",
                i > 0 && (prev?.from === m.from ? "mt-1" : "mt-3"),
              )}
            >
              <span className="sr-only">{you ? "You:" : "Mate:"} </span>
              <p
                className={cn(
                  "max-w-[82%] rounded-[var(--mx-r-panel)] px-4 py-2 text-[15px] leading-snug",
                  you
                    ? "bg-[var(--mx-accent)] text-[var(--mx-accent-ink)]"
                    : "bg-white/10 text-white",
                  lastOfGroup && (you ? "rounded-br-none" : "rounded-bl-none"),
                )}
              >
                {m.text}
              </p>
            </motion.li>
          );
        })}
        {typing && next ? <TypingBubble from={next.from} /> : null}
      </ol>
    </figure>
  );
}
