"use client";

import { ExternalLink } from "lucide-react";
import { cn } from "~/lib/utils";
import type { AccentKey, FaceKey } from "../tokens";
import { SiteFooter, SiteHeader } from "./chrome";
import { findPage, pageSpecs } from "./registry";
import type { PageSpec } from "./types";

export const devices = {
  desktop: { label: "Desktop", width: null },
  tablet: { label: "Tablet", width: 820 },
  phone: { label: "Phone", width: 390 },
} as const;
export type Device = keyof typeof devices;

export type PageSelection = {
  page: string;
  draft: string;
  state: string;
  device: Device;
};

/** Resolve a (possibly stale or partial) selection against the registry. */
export function resolveSelection(sel: Partial<PageSelection>) {
  const spec = findPage(sel.page);
  const draft = spec.drafts.find((d) => d.id === sel.draft) ?? spec.drafts[0]!;
  const state = spec.states.find((s) => s.id === sel.state) ?? spec.states[0]!;
  const device: Device =
    sel.device && sel.device in devices ? sel.device : "desktop";
  return { spec, draft, state, device };
}

/** URL for a single page draft rendered on its own, used by iframes and "open in tab". */
export function frameUrl(
  sel: { page: string; draft: string; state: string },
  accent: AccentKey,
  face: FaceKey,
) {
  const q = new URLSearchParams({
    view: "frame",
    page: sel.page,
    draft: sel.draft,
    state: sel.state,
    accent,
    face,
  });
  return `/ui-test/design?${q.toString()}`;
}

/** Site header + draft + footer: the page as a visitor would see it. */
export function PageFrame({
  spec,
  draftId,
  state,
}: {
  spec: PageSpec;
  draftId: string;
  state: string;
}) {
  const draft = spec.drafts.find((d) => d.id === draftId) ?? spec.drafts[0]!;
  const Draft = draft.Component;
  return (
    <div className="relative min-h-dvh bg-black">
      <SiteHeader active={spec.nav} overHero={draft.heroUnderHeader} />
      <main>
        {/* Keyed by state too: picking a state restarts the draft from it. */}
        <Draft key={`${spec.id}-${draft.id}-${state}`} state={state} />
      </main>
      <SiteFooter />
    </div>
  );
}

const chip = (active: boolean) =>
  cn(
    "h-8 shrink-0 rounded-full px-3 text-[12px] transition-colors",
    active
      ? "bg-white text-black"
      : "text-white/65 hover:bg-white/10 hover:text-white",
  );

/** Page, draft, state and device pickers. Lives in the sticky board header. */
export function PagesControls({
  selection,
  onChange,
  accent,
  face,
}: {
  selection: PageSelection;
  onChange: (next: PageSelection) => void;
  accent: AccentKey;
  face: FaceKey;
}) {
  const { spec, draft, state, device } = resolveSelection(selection);
  const set = (patch: Partial<PageSelection>) =>
    onChange({
      page: spec.id,
      draft: draft.id,
      state: state.id,
      device,
      ...patch,
    });

  return (
    <div className="space-y-2 border-t border-white/10 pt-3">
      <div
        className="no-scrollbar flex items-center gap-1 overflow-x-auto"
        role="tablist"
        aria-label="Page"
      >
        {pageSpecs.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={p.id === spec.id}
            onClick={() =>
              onChange({
                page: p.id,
                draft: p.drafts[0]!.id,
                state: p.states[0]!.id,
                device,
              })
            }
            className={chip(p.id === spec.id)}
          >
            {p.title}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div
          className="flex items-center gap-1"
          role="radiogroup"
          aria-label="Draft"
        >
          <span className="mr-1 font-mono text-[10px] text-white/45 uppercase">
            Draft
          </span>
          {spec.drafts.map((d) => (
            <button
              key={d.id}
              type="button"
              role="radio"
              aria-checked={d.id === draft.id}
              onClick={() => set({ draft: d.id })}
              className={chip(d.id === draft.id)}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div
          // Own row, wrapping: some pages have close to twenty states.
          className="order-last flex w-full items-start gap-1"
          role="radiogroup"
          aria-label="State"
        >
          <span className="mt-2.5 mr-1 shrink-0 font-mono text-[10px] text-white/45 uppercase">
            State
          </span>
          <div className="flex flex-wrap gap-1">
            {spec.states.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={s.id === state.id}
                onClick={() => set({ state: s.id })}
                className={chip(s.id === state.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div
          className="flex items-center gap-1"
          role="radiogroup"
          aria-label="Device"
        >
          {(Object.keys(devices) as Device[]).map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={d === device}
              onClick={() => set({ device: d })}
              className={chip(d === device)}
            >
              {devices[d].label}
            </button>
          ))}
          <a
            href={frameUrl(
              { page: spec.id, draft: draft.id, state: state.id },
              accent,
              face,
            )}
            target="_blank"
            rel="noreferrer"
            aria-label="Open this page on its own in a new tab"
            className="ml-1 flex size-8 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
          >
            <ExternalLink className="size-4" />
          </a>
        </div>
      </div>
      <p className="pb-1 text-[12px] text-white/50">
        <span className="font-mono text-white/40">{spec.route}</span> ·{" "}
        {draft.note}
        {state.hint ? (
          <>
            {" "}
            · <span className="text-white/65">{state.hint}</span>
          </>
        ) : null}
      </p>
    </div>
  );
}

/**
 * The rendered page, always in an iframe so it gets its own viewport: real
 * breakpoints, sticky elements, fixed menus and scroll locking all behave as
 * on the site. Desktop fills the stage; tablet and phone are framed.
 */
export function PagesStage({
  selection,
  accent,
  face,
}: {
  selection: PageSelection;
  accent: AccentKey;
  face: FaceKey;
}) {
  const { spec, draft, state, device } = resolveSelection(selection);
  const width = devices[device].width;
  const src = frameUrl(
    { page: spec.id, draft: draft.id, state: state.id },
    accent,
    face,
  );
  const key = `${spec.id}-${draft.id}-${state.id}-${accent}-${face}`;
  const title = `${spec.title}, draft ${draft.label}, ${state.label}`;

  if (!width)
    return (
      <iframe
        key={key}
        title={title}
        src={src}
        className="block size-full bg-black"
      />
    );

  return (
    <div className="flex justify-center px-5 py-10">
      <div
        className={cn(
          "overflow-hidden border-[6px] border-white/10 bg-black",
          device === "phone" ? "rounded-[40px]" : "rounded-[28px]",
        )}
        style={{ width: width + 12 }}
      >
        <iframe
          key={key}
          title={title}
          src={src}
          className="block bg-black"
          style={{ width, height: device === "phone" ? 844 : 1180 }}
        />
      </div>
    </div>
  );
}
