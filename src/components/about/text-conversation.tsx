"use client"

import {
  motion,
  useScroll,
  AnimatePresence,
} from "framer-motion"
import { useRef, useState, useEffect } from "react"
import { useMainLayoutScrollContainer } from "~/hooks/use-main-layout-scroll-container"

interface Message {
  id: number
  text: string
  sender: "left" | "right"
}

const messages: Message[] = [
  { id: 1, text: "bro where are you tonight", sender: "left" },
  {
    id: 2,
    text: "nothing on why",
    sender: "right",
  },
  {
    id: 3,
    text: "atmos is doing a thing in that old warehouse on tory",
    sender: "left",
  },
  {
    id: 4,
    text: "the one that's been empty for ages?",
    sender: "right",
  },
  {
    id: 5,
    text: "yeah they've completely transformed it",
    sender: "left",
  },
  {
    id: 6,
    text: "last time was unreal. the sound system was insane and the lights were something else",
    sender: "left",
  },
  {
    id: 7,
    text: "idk man i'm pretty cooked from the week",
    sender: "right",
  },
  {
    id: 8,
    text: "that's literally the point",
    sender: "left",
  },
  {
    id: 9,
    text: "you walk in and everything else just switches off",
    sender: "left",
  },
  { id: 10, text: "say less. what time", sender: "right" },
  {
    id: 11,
    text: "doors at 10. don't be late",
    sender: "left",
  },
]

// Determine border radii based on grouping (consecutive same-sender)
function getBubbleRadii(
  index: number,
  visibleMessages: Message[]
) {
  const msg = visibleMessages[index]
  if (!msg) return {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  }
  const prev = index > 0 ? visibleMessages[index - 1] : null
  const next =
    index < visibleMessages.length - 1
      ? visibleMessages[index + 1]
      : null
  const isRight = msg.sender === "right"

  const sameAsPrev = prev?.sender === msg.sender
  const sameAsNext = next?.sender === msg.sender

  const full = 18
  const tight = 5

  if (isRight) {
    return {
      borderTopLeftRadius: full,
      borderBottomLeftRadius: full,
      borderTopRightRadius: sameAsPrev ? tight : full,
      borderBottomRightRadius: sameAsNext ? tight : tight,
    }
  }
  return {
    borderTopRightRadius: full,
    borderBottomRightRadius: full,
    borderTopLeftRadius: sameAsPrev ? tight : full,
    borderBottomLeftRadius: sameAsNext ? tight : tight,
  }
}

// Gap between messages
function getGapAbove(
  index: number,
  visibleMessages: Message[]
) {
  if (index === 0) return 0
  const prev = visibleMessages[index - 1]
  const curr = visibleMessages[index]
  return prev?.sender === curr?.sender ? 2 : 10
}

function TypingBubble({ side }: { side: "left" | "right" }) {
  return (
    <motion.div
      className={`flex ${side === "right" ? "justify-end" : "justify-start"}`}
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{
        opacity: 0,
        scale: 0.6,
        transition: { duration: 0.12, ease: "easeIn" },
      }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 24,
        mass: 0.6,
      }}
      style={{
        transformOrigin:
          side === "right" ? "bottom right" : "bottom left",
        marginTop: 2,
      }}
    >
      <div
        className={`px-4 py-3 ${side === "right"
            ? "bg-blue-600 rounded-2xl rounded-br-[5px]"
            : "bg-secondary rounded-2xl rounded-bl-[5px]"
          }`}
      >
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className={`w-[6px] h-[6px] rounded-full ${side === "right"
                  ? "bg-white/60"
                  : "bg-muted-foreground/50"
                }`}
              animate={{
                y: [0, -4, 0],
                opacity: [0.3, 1, 0.3],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.15,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}

function MessageBubble({
  message,
  index,
  visibleMessages,
}: {
  message: Message
  index: number
  visibleMessages: Message[]
}) {
  const isRight = message.sender === "right"
  const radii = getBubbleRadii(index, visibleMessages)
  const gapAbove = getGapAbove(index, visibleMessages)

  return (
    <motion.div
      layout="position"
      className={`flex ${isRight ? "justify-end" : "justify-start"}`}
      initial={{ opacity: 0, scale: 0.35, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{
        opacity: 0,
        scale: 0.5,
        transition: { duration: 0.1, ease: "easeIn" },
      }}
      transition={{
        type: "spring",
        stiffness: 340,
        damping: 22,
        mass: 0.65,
      }}
      style={{
        transformOrigin: isRight
          ? "bottom right"
          : "bottom left",
        marginTop: gapAbove,
      }}
    >
      <motion.div
        className={`max-w-[80%] px-3 py-[6px] text-[14px] leading-[19px] md:max-w-[78%] md:px-3.5 md:py-[7px] md:text-[15px] md:leading-[20px] ${isRight
            ? "bg-blue-600 text-white"
            : "bg-secondary text-secondary-foreground"
          }`}
        style={radii}
        layout
        transition={{
          layout: {
            type: "spring",
            stiffness: 500,
            damping: 35,
          },
        }}
      >
        {message.text}
      </motion.div>
    </motion.div>
  )
}

export function TextConversation() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const { containerRef } = useMainLayoutScrollContainer()
  const { scrollYProgress } = useScroll({
    container: containerRef,
    target: sectionRef,
    offset: ["start start", "end end"],
  })

  const [visibleCount, setVisibleCount] = useState(0)
  const [showTyping, setShowTyping] = useState(false)
  const [typingSide, setTypingSide] = useState<
    "left" | "right"
  >("left")

  // Debounce typing indicator to prevent flicker
  const typingTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null)
  const lastCountRef = useRef(0)

  useEffect(() => {
    const unsubscribe = scrollYProgress.on(
      "change",
      (progress) => {
        // Map scroll: messages appear across 0.12–0.78
        const msgProgress = Math.max(
          0,
          Math.min(1, (progress - 0.12) / 0.66)
        )

        // Compute how many full messages to show
        const fractional = msgProgress * (messages.length + 1)
        const targetCount = Math.min(
          Math.floor(fractional),
          messages.length
        )

        // Only update if count actually changed
        if (targetCount !== lastCountRef.current) {
          lastCountRef.current = targetCount
          setVisibleCount(targetCount)
        }

        // Typing: show when we're 40–100% toward the next
        // message, with a debounced hide
        const remainder = fractional - Math.floor(fractional)
        const shouldType =
          targetCount < messages.length && remainder > 0.35

        if (shouldType) {
          if (typingTimerRef.current) {
            clearTimeout(typingTimerRef.current)
            typingTimerRef.current = null
          }
          setShowTyping(true)
          setTypingSide(
            messages[targetCount]?.sender || "left"
          )
        } else if (!shouldType && showTyping) {
          // Debounce hiding by a tiny delay to prevent flicker
          if (!typingTimerRef.current) {
            typingTimerRef.current = setTimeout(() => {
              setShowTyping(false)
              typingTimerRef.current = null
            }, 80)
          }
        }
      }
    )

    return () => {
      unsubscribe()
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current)
      }
    }
  }, [scrollYProgress, showTyping])

  const visibleMessages = messages.slice(0, visibleCount)

  return (
    <section ref={sectionRef} className="relative min-h-[250vh]">
      <div className="sticky top-0 flex h-screen flex-col items-center justify-center px-4 py-6 md:px-6 md:py-0">
        {/* Section title */}
        <motion.div
          className="mb-4 text-center md:mb-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          {/* <p className="mb-2 text-xs uppercase tracking-[0.3em] text-muted-foreground md:mb-3 md:text-sm">
            The Escape
          </p> */}
          <h2 className=" text-2xl font-bold tracking-tight text-foreground md:text-4xl">
            {"There\u2019s a lot going on. Leave it at the door."}
          </h2>
        </motion.div>

        {/* Phone frame */}
        <div className="w-full max-w-sm">
          <div className="rounded-4xl border border-border bg-card p-1.5 shadow-2xl shadow-black/50 md:rounded-[2.5rem] md:p-2">
            {/* Status bar */}
            <div className="flex items-center justify-center pb-0.5 pt-2 md:pb-1 md:pt-3">
              <div className="h-[5px] w-[80px] rounded-full bg-muted" />
            </div>

            {/* Chat header */}
            <div className="flex items-center gap-2.5 px-3 py-2 md:gap-3 md:px-4 md:py-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted md:h-9 md:w-9">
                <span className="text-xs font-bold text-muted-foreground">
                  A
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  atmos crew
                </p>
                <p className="text-[11px] text-muted-foreground">
                  group chat
                </p>
              </div>
            </div>

            <div className="mx-1 h-px bg-border/50" />

            {/* Messages area */}
            <div className="flex min-h-[300px] max-h-[300px] flex-col justify-end overflow-hidden rounded-b-3xl bg-background px-2.5 py-2.5 md:min-h-[420px] md:max-h-[420px] md:rounded-b-4xl md:px-3 md:py-3">
              <AnimatePresence initial={false} mode="popLayout">
                {visibleMessages.map((msg, i) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    index={i}
                    visibleMessages={visibleMessages}
                  />
                ))}
                {showTyping && (
                  <TypingBubble key="typing" side={typingSide} />
                )}
              </AnimatePresence>
            </div>

            {/* Input bar */}
            <div className="flex items-center gap-2 px-3 pb-3 pt-1.5 md:pb-4 md:pt-2">
              <div className="h-[34px] flex-1 rounded-full border border-border/60 bg-secondary/50 px-4 flex items-center md:h-[36px]">
                <span className="text-xs text-muted-foreground/40">
                  iMessage
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}