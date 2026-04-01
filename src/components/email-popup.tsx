"use client";

import { useEffect, useRef, useState } from "react";
import { X, CheckCircle2 } from "lucide-react";
import { api } from "~/trpc/react";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import { orbitron } from "~/lib/fonts";

const STORAGE_KEY = "atmosEmailPopupSeen";

export function EmailPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const subscribeAudioRef = useRef<HTMLAudioElement | null>(null);

  const subscribe = api.newsletter.subscribe.useMutation();

  useEffect(() => {
    subscribeAudioRef.current?.load();
  }, []);

  const playSubscribeSound = () => {
    try {
      const audio = subscribeAudioRef.current;
      if (!audio) return;
      audio.currentTime = 0;
      audio.volume = 0.6;
      void audio.play();
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    try {
      if (
        typeof window !== "undefined" &&
        localStorage.getItem(STORAGE_KEY) === "true"
      ) {
        return;
      }
    } catch {
      // localStorage blocked — still offer popup
    }

    timer = setTimeout(() => {
      if (!cancelled) setIsOpen(true);
    }, 5000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const markSeen = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // ignore
    }
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
      markSeen();
    }, 400);
  };

  const validateEmail = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "Please enter your email";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return "Please enter a valid email address";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);

    const err = validateEmail(email);
    if (err) {
      setEmailError(err);
      return;
    }

    try {
      await subscribe.mutateAsync({ email: email.trim() });
      playSubscribeSound();
      setIsSubmitted(true);
      setEmail("");
      setTimeout(() => {
        handleClose();
      }, 2200);
    } catch {
      setEmailError("Couldn't subscribe right now — please try again.");
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-popup-title"
    >
      <audio ref={subscribeAudioRef} preload="auto" src="/subscribe.mp3" />

      <button
        type="button"
        className="absolute inset-0 bg-black/80"
        aria-label="Dismiss newsletter"
        onClick={handleClose}
      />

      <div
        className={cn(
          "pointer-events-auto relative z-10 w-full max-w-2xl overflow-hidden rounded-none border-2 border-white/10 bg-black text-white shadow-[0_0_30px_rgba(72,49,149,0.35)] transition-transform duration-500 ease-out",
          isClosing ? "translate-y-full" : "translate-y-0",
        )}
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-3 right-3 z-10 rounded-none p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          <X className="size-5" />
        </button>

        {!isSubmitted ? (
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:gap-6 sm:p-6">
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="text-[10px] font-semibold tracking-[0.3em] text-white/50 uppercase">
                Newsletter
              </p>
              <h2
                id="email-popup-title"
                className={cn(
                  "mt-2 text-2xl font-black tracking-tight text-white uppercase sm:text-3xl",
                  orbitron.className,
                )}
              >
                Join the{" "}
                <span className="text-accent-strong italic">atmosphere</span>
              </h2>
              <p className="mt-2 text-sm text-white/60">
                Gigs, mixes, merch drops — straight to your inbox.
              </p>
            </div>

            <form
              onSubmit={(e) => void handleSubmit(e)}
              className="flex w-full flex-col gap-2 sm:max-w-md sm:flex-row sm:items-stretch"
            >
              <div className="min-w-0 flex-1">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError(null);
                  }}
                  placeholder="Enter your email"
                  autoComplete="email"
                  disabled={subscribe.isPending}
                  aria-invalid={Boolean(emailError)}
                  className={cn(
                    "focus:border-accent-muted focus:ring-accent-muted/20 h-12 rounded-none border-2 bg-black/60 text-white placeholder:text-white/40",
                    emailError && "border-red-500/60",
                  )}
                />
                {emailError && (
                  <p className="mt-1.5 text-left text-xs text-red-300/90">
                    {emailError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={subscribe.isPending}
                className="border-accent-strong bg-accent-strong hover:border-accent-muted hover:bg-accent-muted h-12 shrink-0 rounded-none border-2 px-6 text-xs font-black tracking-wider text-white uppercase transition-all hover:shadow-[0_0_20px_var(--accent-muted)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {subscribe.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Joining…
                  </span>
                ) : (
                  "Subscribe"
                )}
              </button>
            </form>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 p-6 sm:flex-row sm:justify-center sm:text-left">
            <div className="border-accent-muted bg-accent-muted/20 flex size-14 shrink-0 items-center justify-center border-2">
              <CheckCircle2 className="text-accent-muted size-8" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-wide text-white uppercase">
                You&apos;re in
              </h3>
              <p className="mt-1 text-sm text-white/60">
                Thanks — we&apos;ll be in touch with updates soon.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
