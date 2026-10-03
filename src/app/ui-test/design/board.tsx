"use client";

import { useEffect, useState } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { ShoppingBag } from "lucide-react";
import { cn } from "~/lib/utils";
import { BoardProvider, useBoard } from "./board-state";
import { fontVariables } from "./fonts";
import { CartSheet, ToastViewport } from "./overlays";
import { BoardSection } from "./primitives";
import {
  accentVars,
  accents,
  faceVars,
  faces,
  type AccentKey,
  type FaceKey,
} from "./tokens";
import { HeroSection } from "./sections/hero";
import { FoundationsSection } from "./sections/foundations";
import { ControlsSection } from "./sections/controls";
import { FormsSection } from "./sections/forms";
import { OverlaysSection } from "./sections/overlays-demo";
import { NavSection } from "./sections/nav";
import { GigsSection } from "./sections/gigs";
import { DetailSection } from "./sections/detail";
import { CheckoutSection } from "./sections/checkout";
import { ContentSection } from "./sections/content";
import { MerchSection } from "./sections/merch";
import { FeedbackSection } from "./sections/feedback";
import { ClosingSection } from "./sections/closing";
import {
  PageFrame,
  PagesControls,
  PagesStage,
  resolveSelection,
  type Device,
  type PageSelection,
} from "./pages/pages-view";

const sections = [
  {
    id: "hero",
    title: "Hero",
    note: "Photo lives here and only here. Everything below sits on true black.",
    Body: HeroSection,
  },
  {
    id: "foundations",
    title: "Foundations",
    note: "Type, accent candidates, shape rules and glass. Toolbar switches apply to the whole board.",
    Body: FoundationsSection,
  },
  { id: "controls", title: "Controls", Body: ControlsSection },
  {
    id: "forms",
    title: "Forms",
    note: "Validation runs on submit and clears as you fix each field.",
    Body: FormsSection,
  },
  { id: "overlays", title: "Overlays", Body: OverlaysSection },
  {
    id: "nav",
    title: "Navigation",
    note: "Replaces the purple slab sidebar with a top bar on desktop and a full-screen menu on mobile.",
    Body: NavSection,
  },
  { id: "gigs", title: "Gigs", Body: GigsSection },
  {
    id: "detail",
    title: "Gig page",
    note: "Checkout opens the full flow in a dialog. Add to calendar downloads a real .ics.",
    Body: DetailSection,
  },
  { id: "checkout", title: "Checkout", Body: CheckoutSection },
  { id: "content", title: "Content", Body: ContentSection },
  {
    id: "merch",
    title: "Merch",
    note: "Adds go to one shared cart: nav badge, toasts and the cart sheet all follow it.",
    Body: MerchSection,
  },
  { id: "feedback", title: "Feedback", Body: FeedbackSection },
  { id: "closing", title: "Footer", Body: ClosingSection },
] as const;

export type BoardParams = Record<string, string | undefined>;

const pick = <T extends string>(
  value: string | undefined,
  options: Record<T, unknown>,
  fallback: T,
): T => (value && value in options ? (value as T) : fallback);

function Board({ params }: { params: BoardParams }) {
  const { setPortalContainer, cartCount, setCartOpen } = useBoard();
  const [accent, setAccent] = useState<AccentKey>(
    pick(params.accent, accents, "violet"),
  );
  const [face, setFace] = useState<FaceKey>(
    pick(params.face, faces, "archivo"),
  );
  const [mode, setMode] = useState<"system" | "pages">(
    params.mode === "pages" ? "pages" : "system",
  );
  const [selection, setSelection] = useState<PageSelection>(() => {
    const { spec, draft, state, device } = resolveSelection({
      page: params.page,
      draft: params.draft,
      state: params.state,
      device: params.device as Device,
    });
    return { page: spec.id, draft: draft.id, state: state.id, device };
  });

  // Keep the URL in step so a view can be reloaded or shared.
  useEffect(() => {
    const q = new URLSearchParams({ mode, accent, face });
    if (mode === "pages")
      Object.entries(selection).forEach(([k, v]) => q.set(k, v));
    window.history.replaceState(null, "", `?${q.toString()}`);
  }, [mode, accent, face, selection]);

  return (
    <div
      className={cn(
        "mx",
        mode === "pages" ? "flex h-dvh flex-col" : "min-h-dvh",
        fontVariables,
      )}
      style={{ ...accentVars(accent), ...faceVars(face) }}
    >
      <div className="mx-glass-dark sticky top-0 z-50 shrink-0 border-x-0 border-t-0 px-5 py-3 md:px-10">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <p className="mx-label text-[12px]">Atmos design mocks</p>

          <div
            className="inline-flex rounded-full border border-white/15 p-0.5"
            role="radiogroup"
            aria-label="Board mode"
          >
            {(["system", "pages"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  "h-8 rounded-full px-3 text-[12px] capitalize transition-colors",
                  mode === m
                    ? "bg-[var(--mx-accent)] text-[var(--mx-accent-ink)]"
                    : "text-white/65 hover:text-white",
                )}
              >
                {m}
              </button>
            ))}
          </div>

          <div
            className="flex items-center gap-2"
            role="radiogroup"
            aria-label="Accent"
          >
            {(Object.keys(accents) as AccentKey[]).map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={accent === key}
                aria-label={accents[key].name}
                title={accents[key].name}
                onClick={() => setAccent(key)}
                className={cn(
                  "size-6 rounded-full ring-offset-2 ring-offset-black transition-shadow",
                  accent === key ? "ring-2 ring-white" : "ring-1 ring-white/20",
                )}
                style={{ background: accents[key].fill }}
              />
            ))}
          </div>

          <div
            className="inline-flex rounded-full border border-white/15 p-0.5"
            role="radiogroup"
            aria-label="Display face"
          >
            {(Object.keys(faces) as FaceKey[]).map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={face === key}
                onClick={() => setFace(key)}
                className={cn(
                  "h-8 rounded-full px-3 text-[12px] transition-colors",
                  face === key
                    ? "bg-white text-black"
                    : "text-white/65 hover:text-white",
                )}
              >
                {faces[key].name}
              </button>
            ))}
          </div>

          {/* The page previews run in iframes with their own cart. */}
          {mode === "system" ? (
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              aria-label={`Cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}`}
              className="relative inline-flex size-9 items-center justify-center rounded-full text-white/75 hover:text-white"
            >
              <ShoppingBag className="size-[18px]" />
              {cartCount ? (
                <span
                  key={cartCount}
                  className="mx-num animate-in zoom-in-50 absolute top-0 -right-0.5 flex size-4 items-center justify-center rounded-full bg-[var(--mx-accent)] text-[9px] font-bold text-[var(--mx-accent-ink)] duration-200"
                >
                  {cartCount}
                </span>
              ) : null}
            </button>
          ) : null}

          {mode === "system" ? (
            <nav className="no-scrollbar ml-auto flex gap-4 overflow-x-auto text-[12px] text-white/60 max-xl:w-full">
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="shrink-0 hover:text-white"
                >
                  {s.title}
                </a>
              ))}
            </nav>
          ) : null}
        </div>
        {mode === "pages" ? (
          <div className="mt-3">
            <PagesControls
              selection={selection}
              onChange={setSelection}
              accent={accent}
              face={face}
            />
          </div>
        ) : null}
      </div>

      {mode === "system" ? (
        <>
          <p className="px-5 pt-6 text-[13px] text-white/50 md:px-10">
            Real gigs, posters, crew and merch. Prices, ticket tiers, FAQ
            answers and some copy are illustrative. Nothing is sent anywhere.
          </p>

          {sections.map(({ id, title, Body, ...rest }) => (
            <BoardSection
              key={id}
              id={id}
              title={title}
              note={"note" in rest ? rest.note : undefined}
            >
              <Body />
            </BoardSection>
          ))}
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <PagesStage selection={selection} accent={accent} face={face} />
        </div>
      )}

      <CartSheet />
      <ToastViewport />
      {/* Overlays portal here so they inherit fonts and accent variables. */}
      <div ref={setPortalContainer} />
    </div>
  );
}

/** One page draft on its own: what the tablet/phone iframes and "open in tab" load. */
function FrameView({ params }: { params: BoardParams }) {
  const { setPortalContainer } = useBoard();
  const { spec, draft, state } = resolveSelection({
    page: params.page,
    draft: params.draft,
    state: params.state,
  });
  const accent = pick(params.accent, accents, "violet");
  const face = pick(params.face, faces, "archivo");
  return (
    <div
      className={cn("mx min-h-dvh", fontVariables)}
      style={{ ...accentVars(accent), ...faceVars(face) }}
    >
      <PageFrame spec={spec} draftId={draft.id} state={state.id} />
      <CartSheet />
      <ToastViewport />
      <div ref={setPortalContainer} />
    </div>
  );
}

/** Mock board for the proposed public-site design system. */
export function DesignBoard({ params }: { params: BoardParams }) {
  return (
    <BoardProvider>
      <Tooltip.Provider delayDuration={200}>
        {params.view === "frame" ? (
          <FrameView params={params} />
        ) : (
          <Board params={params} />
        )}
      </Tooltip.Provider>
    </BoardProvider>
  );
}
