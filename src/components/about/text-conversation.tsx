"use client";

import {
  motion,
  useScroll,
  useTransform,
  AnimatePresence,
  LayoutGroup,
} from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { useMainLayoutScrollContainer } from "~/hooks/use-main-layout-scroll-container";

interface Message {
  id: number;
  text: string;
  sender: "left" | "right";
  delay: number;
}

const messages: Message[] = [
  { id: 1, text: "bro where are you tonight", sender: "left", delay: 0 },
  { id: 2, text: "nothing on why", sender: "right", delay: 0.08 },
  {
    id: 3,
    text: "atmos is doing a thing in that old warehouse on tory",
    sender: "left",
    delay: 0.16,
  },
  {
    id: 4,
    text: "the one that's been empty for ages?",
    sender: "right",
    delay: 0.24,
  },
  {
    id: 5,
    text: "yeah they've completely transformed it",
    sender: "left",
    delay: 0.32,
  },
  {
    id: 6,
    text: "last time was unreal. the sound system was insane and the lights were something else",
    sender: "left",
    delay: 0.4,
  },
  {
    id: 7,
    text: "idk man i'm pretty cooked from the week",
    sender: "right",
    delay: 0.48,
  },
  {
    id: 8,
    text: "that's literally the point",
    sender: "left",
    delay: 0.56,
  },
  {
    id: 9,
    text: "you walk in and everything else just switches off",
    sender: "left",
    delay: 0.64,
  },
  {
    id: 10,
    text: "say less. what time",
    sender: "right",
    delay: 0.72,
  },
  {
    id: 11,
    text: "doors at 10. don't be late",
    sender: "left",
    delay: 0.8,
  },
];

function TypingBubble({ side }: { side: "left" | "right" }) {
  return (
    <motion.div
      layout
      className={`flex ${side === "right" ? "justify-end" : "justify-start"}`}
      layoutId="incoming-bubble"
    >
      <motion.div
        className={`px-4 py-2.5 rounded-2xl ${side === "right"
            ? "bg-blue-600 rounded-br-sm"
            : "bg-secondary rounded-bl-sm"
          }`}
        layout
      >
        <div className="flex gap-1.5 items-center h-[22px]">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className={`w-[5px] h-[5px] rounded-full ${side === "right"
                  ? "bg-white/50"
                  : "bg-muted-foreground/50"
                }`}
              animate={{
                y: [0, -3, 0],
                opacity: [0.4, 1, 0.4],
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

function MessageBubble({
  message,
  isNewest,
}: {
  message: Message;
  isNewest: boolean;
}) {
  const isRight = message.sender === "right";

  return (
    <motion.div
      layout
      className={`flex ${isRight ? "justify-end" : "justify-start"}`}
      layoutId={isNewest ? "incoming-bubble" : undefined}
    >
      <motion.div
        layout
        className={`max-w-[75%] px-4 py-2.5 text-[15px] leading-relaxed ${isRight
            ? "bg-blue-600 text-white rounded-2xl rounded-br-sm"
            : "bg-secondary text-secondary-foreground rounded-2xl rounded-bl-sm"
          }`}
      >
        <motion.span
          initial={isNewest ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, delay: 0.1 }}
          className="block"
        >
          {message.text}
        </motion.span>
      </motion.div>
    </motion.div>
  );
}

export function TextConversation() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { containerRef } = useMainLayoutScrollContainer();
  const { scrollYProgress } = useScroll({
    container: containerRef,
    target: sectionRef,
    offset: ["start start", "end end"],
  });
  const headingOpacity = useTransform(scrollYProgress, [0.05, 0.18], [0, 1]);
  const headingY = useTransform(scrollYProgress, [0.05, 0.18], [36, 0]);
  const phoneY = useTransform(scrollYProgress, [0, 1], [40, -28]);
  const phoneRotate = useTransform(scrollYProgress, [0, 1], [-1.5, 1.5]);
  const phoneScale = useTransform(scrollYProgress, [0, 0.2, 1], [0.96, 1, 1.02]);

  const [visibleCount, setVisibleCount] = useState(0);
  const [showTyping, setShowTyping] = useState(false);
  const [typingSide, setTypingSide] = useState<"left" | "right">("left");
  const [newestId, setNewestId] = useState<number | null>(null);
  const prevCountRef = useRef(0);

  useEffect(() => {
    const unsubscribe = scrollYProgress.on("change", (progress) => {
      const msgProgress = Math.max(0, Math.min(1, progress));
      const targetCount = Math.floor(msgProgress * messages.length);
      setVisibleCount(targetCount);

      const fractional = msgProgress * messages.length;
      const remainder = fractional - Math.floor(fractional);
      if (targetCount < messages.length && remainder > 0.3) {
        setShowTyping(true);
        setTypingSide(messages[targetCount]?.sender || "left");
      } else {
        setShowTyping(false);
      }
    });

    return () => unsubscribe();
  }, [scrollYProgress]);

  // Track when a new message appears to assign shared layoutId
  useEffect(() => {
    if (visibleCount > prevCountRef.current && visibleCount > 0) {
      const id = messages[visibleCount - 1]!.id;
      setNewestId(id);
      const timer = setTimeout(() => setNewestId(null), 700);
      prevCountRef.current = visibleCount;
      return () => clearTimeout(timer);
    }
    prevCountRef.current = visibleCount;
  }, [visibleCount]);

  return (
    <section ref={sectionRef} className="relative min-h-[250vh]">
        <motion.div className="fixed top-4 left-0 right-0 h-[4px] z-9999 bg-white" style={{ scaleX: scrollYProgress, originX: 0 }} />

      <div className="sticky top-0 flex h-screen flex-col items-center justify-center px-6">
        <motion.div
          className="mb-8 text-center"
          style={{ opacity: headingOpacity, y: headingY }}
        >
          <p className="mb-3 text-sm uppercase tracking-[0.3em] text-muted-foreground">
            The Escape
          </p>
          <h2 className="font-serif text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            {"The world is loud. Atmos is the off switch."}
          </h2>
        </motion.div>

        <motion.div
          className="w-full max-w-sm"
          style={{ y: phoneY, rotate: phoneRotate, scale: phoneScale }}
        >
          <div className="rounded-3xl border border-border bg-card p-2 shadow-2xl shadow-black/50">
            <div className="flex items-center gap-3 rounded-t-2xl bg-secondary px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                <span className="text-xs font-bold text-muted-foreground">
                  A
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  atmos crew
                </p>
                <p className="text-xs text-muted-foreground">group chat</p>
              </div>
            </div>

            <div className="flex min-h-[420px] max-h-[420px] flex-col justify-end gap-2.5 overflow-hidden rounded-b-2xl bg-background px-4 py-4">
              <LayoutGroup>
                <AnimatePresence mode="popLayout">
                  {messages.slice(0, visibleCount).map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isNewest={msg.id === newestId}
                    />
                  ))}
                  {showTyping && (
                    <TypingBubble key="typing" side={typingSide} />
                  )}
                </AnimatePresence>
              </LayoutGroup>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}