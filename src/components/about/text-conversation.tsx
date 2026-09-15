"use client";

import { AnimatePresence, motion, useScroll } from "motion/react";
import {
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Mic,
  Plus,
  Video,
  Wifi,
} from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { useMainLayoutScrollContainer } from "~/hooks/use-main-layout-scroll-container";

// "me" owns the phone (blue bubbles); "them" is the friend (gray bubbles).
type Sender = "them" | "me";

interface Message {
  id: number;
  text: string;
  sender: Sender;
}

const messages: Message[] = [
  { id: 1, text: "bro where are you tonight", sender: "them" },
  { id: 2, text: "nothing on why", sender: "me" },
  {
    id: 3,
    text: "atmos is doing a thing in that old warehouse on tory",
    sender: "them",
  },
  { id: 4, text: "the one that's been empty for ages?", sender: "me" },
  { id: 5, text: "yeah they've completely transformed it", sender: "them" },
  {
    id: 6,
    text: "last time was unreal. the sound system was insane and the lights were something else",
    sender: "them",
  },
  { id: 7, text: "idk man i'm pretty cooked from the week", sender: "me" },
  { id: 8, text: "that's literally the point", sender: "them" },
  {
    id: 9,
    text: "you walk in and everything else just switches off",
    sender: "them",
  },
  { id: 10, text: "say less. what time", sender: "me" },
  { id: 11, text: "doors at 10. don't be late", sender: "them" },
];

// The phone is laid out at iPhone 15 Pro logical size, then scaled to fit.
const SCREEN = { width: 393, height: 852 };
const BEZEL = 14;
const FRAME = {
  width: SCREEN.width + BEZEL * 2,
  height: SCREEN.height + BEZEL * 2,
};

const ios = {
  blue: "#0A84FF",
  gray: "#262629",
  muted: "#8E8E93",
  bar: "rgba(28,28,30,0.94)",
  font: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif',
};

interface ChatState {
  count: number;
  /** Who is composing the next message; `chars` is how much of it "me" has typed. */
  typing: { side: Sender; chars: number } | null;
}

// Messages land across scroll progress 0.12–0.78. Within each message's slot the
// last 65% shows a typing bubble (them) or the text being typed into the field (me).
function chatStateAt(progress: number): ChatState {
  const p = Math.max(0, Math.min(1, (progress - 0.12) / 0.66));
  const fractional = p * (messages.length + 1);
  const count = Math.min(Math.floor(fractional), messages.length);
  const next = messages[count];
  const remainder = fractional - Math.floor(fractional);
  if (!next || remainder < 0.35) return { count, typing: null };

  const typed = (remainder - 0.35) / 0.65;
  return {
    count,
    typing: {
      side: next.sender,
      chars: next.sender === "me" ? Math.ceil(typed * next.text.length) : 0,
    },
  };
}

function sameChatState(a: ChatState, b: ChatState) {
  return (
    a.count === b.count &&
    a.typing?.side === b.typing?.side &&
    a.typing?.chars === b.typing?.chars
  );
}

// Scale that fits the fixed-size phone frame inside the given element.
function useFitScale(ref: RefObject<HTMLDivElement | null>) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setScale(Math.min(width / FRAME.width, height / FRAME.height, 1));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return scale;
}

function gapAbove(prev: Message | undefined, sender: Sender) {
  if (!prev) return 0;
  return prev.sender === sender ? 2 : 10;
}

// Curved iMessage tail on the last bubble of a group. The second span is
// screen-coloured and carves the outer edge of the tail.
function Tail({ side, color }: { side: Sender; color: string }) {
  const mine = side === "me";
  return (
    <>
      <span
        aria-hidden="true"
        className="absolute bottom-0 h-5 w-5"
        style={
          mine
            ? { right: -8, background: color, borderBottomLeftRadius: 15 }
            : { left: -8, background: color, borderBottomRightRadius: 15 }
        }
      />
      <span
        aria-hidden="true"
        className="absolute bottom-0 h-5 w-[10px] bg-black"
        style={
          mine
            ? { right: -10, borderBottomLeftRadius: 10 }
            : { left: -10, borderBottomRightRadius: 10 }
        }
      />
    </>
  );
}

function Bubble({
  message,
  gap,
  hasTail,
}: {
  message: Message;
  gap: number;
  hasTail: boolean;
}) {
  const mine = message.sender === "me";
  const color = mine ? ios.blue : ios.gray;

  return (
    <motion.div
      layout="position"
      className={`flex ${mine ? "justify-end" : "justify-start"}`}
      style={{
        marginTop: gap,
        transformOrigin: mine ? "bottom right" : "bottom left",
      }}
      initial={{ opacity: 0, scale: 0.35, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{
        opacity: 0,
        scale: 0.5,
        transition: { duration: 0.1, ease: "easeIn" },
      }}
      transition={{ type: "spring", stiffness: 340, damping: 22, mass: 0.65 }}
    >
      <div
        className="relative max-w-[75%] rounded-[18px] px-3 py-[7px] text-[17px] leading-[22px] text-white"
        style={{ background: color }}
      >
        {message.text}
        {hasTail && <Tail side={message.sender} color={color} />}
      </div>
    </motion.div>
  );
}

function TypingBubble({ gap }: { gap: number }) {
  return (
    <motion.div
      className="flex justify-start"
      style={{ marginTop: gap, transformOrigin: "bottom left" }}
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{
        opacity: 0,
        scale: 0.6,
        transition: { duration: 0.12, ease: "easeIn" },
      }}
      transition={{ type: "spring", stiffness: 400, damping: 24, mass: 0.6 }}
    >
      <div
        className="relative flex h-[36px] items-center gap-[5px] rounded-[18px] px-4"
        style={{ background: ios.gray }}
      >
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-2 w-2 rounded-full"
            style={{ background: ios.muted }}
            animate={{ opacity: [0.35, 1, 0.35] }}
            transition={{
              duration: 1.1,
              repeat: Infinity,
              delay: i * 0.18,
              ease: "easeInOut",
            }}
          />
        ))}
        <Tail side="them" color={ios.gray} />
      </div>
    </motion.div>
  );
}

function StatusBar() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[59px] text-white">
      <span className="absolute top-[19px] left-[42px] text-[17px] font-semibold">
        9:41
      </span>
      <div className="absolute top-[22px] right-[34px] flex items-center gap-[7px]">
        <svg
          width="19"
          height="12"
          viewBox="0 0 19 12"
          fill="currentColor"
          aria-hidden="true"
        >
          <rect x="0" y="8" width="3.5" height="4" rx="0.8" />
          <rect x="5" y="5.5" width="3.5" height="6.5" rx="0.8" />
          <rect x="10" y="3" width="3.5" height="9" rx="0.8" />
          <rect x="15" y="0" width="3.5" height="12" rx="0.8" />
        </svg>
        <Wifi size={16} strokeWidth={2.5} aria-hidden="true" />
        <svg width="27" height="13" viewBox="0 0 27 13" aria-hidden="true">
          <rect
            x="0.5"
            y="0.5"
            width="23"
            height="12"
            rx="3.5"
            stroke="currentColor"
            strokeOpacity="0.4"
            fill="none"
          />
          <rect x="2" y="2" width="20" height="9" rx="2" fill="currentColor" />
          <path
            d="M25 4.5v4a2 2 0 0 0 0-4z"
            fill="currentColor"
            fillOpacity="0.4"
          />
        </svg>
      </div>
      {/* Dynamic Island */}
      <div className="absolute top-[11px] left-1/2 h-[37px] w-[126px] -translate-x-1/2 rounded-full bg-black" />
    </div>
  );
}

function Header() {
  return (
    <div
      className="flex h-[150px] shrink-0 flex-col justify-end border-b border-white/10 pb-[6px]"
      style={{ background: ios.bar }}
    >
      <div className="flex items-end justify-between px-[8px]">
        <ChevronLeft
          size={30}
          strokeWidth={2.4}
          className="mb-[16px] text-[#0A84FF]"
          aria-hidden="true"
        />
        <div className="flex flex-col items-center gap-[3px]">
          <div className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-linear-to-b from-[#9A9AA0] to-[#6E6E73] text-[19px] font-medium text-white">
            AC
          </div>
          <span className="flex items-center text-[11px] text-white">
            atmos crew
            <ChevronRight
              size={11}
              strokeWidth={2.5}
              className="ml-[1px] text-[#8E8E93]"
              aria-hidden="true"
            />
          </span>
        </div>
        <Video
          size={26}
          strokeWidth={2}
          className="mr-[10px] mb-[16px] text-[#0A84FF]"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

function Composer({ draft }: { draft: string }) {
  return (
    <div className="shrink-0">
      <div className="flex items-end gap-[10px] px-[14px] pt-[6px] pb-[8px]">
        <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#2C2C2E] text-[#8E8E93]">
          <Plus size={22} strokeWidth={2.2} aria-hidden="true" />
        </div>
        <div className="flex min-h-[36px] min-w-0 flex-1 items-end rounded-[18px] border border-[#3A3A3C] py-[3px] pr-[3px] pl-[14px]">
          {draft ? (
            <span className="min-w-0 flex-1 py-[3px] text-[17px] leading-[22px] break-words text-white">
              {draft}
            </span>
          ) : (
            <span className="flex-1 py-[3px] text-[17px] leading-[22px] text-[#8E8E93]">
              iMessage
            </span>
          )}
          {draft ? (
            <span
              className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full text-white"
              style={{ background: ios.blue }}
            >
              <ArrowUp size={18} strokeWidth={3} aria-hidden="true" />
            </span>
          ) : (
            <Mic
              size={20}
              className="mr-[6px] mb-[4px] shrink-0 text-[#8E8E93]"
              aria-hidden="true"
            />
          )}
        </div>
      </div>
      {/* Home indicator */}
      <div className="flex h-[34px] items-start justify-center pt-[13px]">
        <div className="h-[5px] w-[134px] rounded-full bg-white" />
      </div>
    </div>
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative rounded-[66px] border border-[#3A3A3C] bg-[#0E0E10] shadow-[0_40px_120px_rgba(0,0,0,0.7)]"
      style={{ width: FRAME.width, height: FRAME.height, padding: BEZEL }}
    >
      {/* Side buttons */}
      <span
        aria-hidden="true"
        className="absolute top-[150px] -left-[3px] h-[30px] w-[3px] rounded-l-sm bg-[#2A2A2C]"
      />
      <span
        aria-hidden="true"
        className="absolute top-[210px] -left-[3px] h-[62px] w-[3px] rounded-l-sm bg-[#2A2A2C]"
      />
      <span
        aria-hidden="true"
        className="absolute top-[286px] -left-[3px] h-[62px] w-[3px] rounded-l-sm bg-[#2A2A2C]"
      />
      <span
        aria-hidden="true"
        className="absolute top-[240px] -right-[3px] h-[98px] w-[3px] rounded-r-sm bg-[#2A2A2C]"
      />

      <div
        className="relative flex h-full w-full flex-col overflow-hidden rounded-[52px] bg-black"
        style={{ fontFamily: ios.font }}
      >
        <StatusBar />
        {children}
      </div>
    </div>
  );
}

export function TextConversation() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const fitRef = useRef<HTMLDivElement>(null);
  const { containerRef } = useMainLayoutScrollContainer();
  const { scrollYProgress } = useScroll({
    container: containerRef,
    target: sectionRef,
    offset: ["start start", "end end"],
  });
  const scale = useFitScale(fitRef);
  const [chat, setChat] = useState<ChatState>({ count: 0, typing: null });

  useEffect(
    () =>
      scrollYProgress.on("change", (progress) => {
        const next = chatStateAt(progress);
        setChat((prev) => (sameChatState(prev, next) ? prev : next));
      }),
    [scrollYProgress],
  );

  const visible = messages.slice(0, chat.count);
  const last = visible[visible.length - 1];
  const upcoming = messages[chat.count];
  const draft =
    chat.typing?.side === "me" && upcoming
      ? upcoming.text.slice(0, chat.typing.chars)
      : "";
  const showTypingBubble = chat.typing?.side === "them";

  return (
    <section ref={sectionRef} className="relative min-h-[250vh]">
      {/* Extra top padding below lg clears the sticky mobile nav and its blur. */}
      <div className="sticky top-0 flex h-screen flex-col items-center px-4 pt-24 pb-4 md:px-6 lg:pt-10 lg:pb-8">
        <motion.h2
          className="mb-4 text-center text-2xl font-bold tracking-tight md:mb-6 md:text-4xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          {"There’s a lot going on. Leave it at the door."}
        </motion.h2>

        <div
          ref={fitRef}
          className="flex min-h-0 w-full flex-1 items-center justify-center"
        >
          {/* Outer box reserves the scaled size so the frame stays centred. */}
          <div
            style={{ width: FRAME.width * scale, height: FRAME.height * scale }}
          >
            <div
              style={{
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
            >
              <PhoneFrame>
                <Header />

                <div className="flex min-h-0 flex-1 flex-col justify-end overflow-hidden px-4 pb-2">
                  {visible.length > 0 && (
                    <p className="mb-2 text-center text-[11px] text-[#8E8E93]">
                      <span className="font-semibold">Today</span> 9:41 PM
                    </p>
                  )}
                  <AnimatePresence initial={false} mode="popLayout">
                    {visible.map((message, i) => {
                      const after = visible[i + 1];
                      const followedBySame = after
                        ? after.sender === message.sender
                        : showTypingBubble && message.sender === "them";
                      return (
                        <Bubble
                          key={message.id}
                          message={message}
                          gap={gapAbove(visible[i - 1], message.sender)}
                          hasTail={!followedBySame}
                        />
                      );
                    })}
                    {showTypingBubble && (
                      <TypingBubble key="typing" gap={gapAbove(last, "them")} />
                    )}
                  </AnimatePresence>
                  {last?.sender === "me" && !chat.typing && (
                    <p className="mt-[3px] mr-[2px] text-right text-[11px] font-medium text-[#8E8E93]">
                      Delivered
                    </p>
                  )}
                </div>

                <Composer draft={draft} />
              </PhoneFrame>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
