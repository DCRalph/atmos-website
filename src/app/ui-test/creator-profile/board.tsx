"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ExternalLink, RotateCcw, SlidersHorizontal } from "lucide-react";
import { cn } from "~/lib/utils";
import { SiteFooter } from "~/components/site/site-footer";
import { buildProfile, profileStates, type ProfileStateId } from "./fixtures";
import { profileFontVariables } from "./fonts";
import { ProfileHeader } from "./parts";
import {
  accentSwatches,
  faces,
  groundSwatches,
  isHex,
  presets,
  resolveTheme,
  themeVars,
  type Corners,
  type FaceKey,
  type PhotoTreatment,
  type PresetKey,
  type ThemeChoice,
} from "./themes";
import { HeadlinerDraft } from "./drafts/headliner";
import { WallDraft } from "./drafts/wall";
import { StageDraft } from "./drafts/stage";

const drafts = {
  headliner: {
    label: "A · Headliner",
    note: "The reference's next-show hero as a person: photo, name, countdown, then the run in a rail. Sets by month on calendar tiles, past sets as a poster carousel.",
    Component: HeadlinerDraft,
  },
  wall: {
    label: "B · Wall",
    note: "Type first: their name edge to edge, one identity strip, then every set they've played as a poster wall by year. Their Atmos history is the page.",
    Component: WallDraft,
  },
  stage: {
    label: "C · Stage",
    note: "Link-in-bio on a phone, press kit on desktop: the portrait column stays put while tabbed sections scroll beside it.",
    Component: StageDraft,
  },
} as const;
type DraftId = keyof typeof drafts;

const devices = {
  desktop: { label: "Desktop", width: null },
  tablet: { label: "Tablet", width: 820 },
  phone: { label: "Phone", width: 390 },
} as const;
type Device = keyof typeof devices;

/** Theme choices a creator can override on top of a preset. */
type Overrides = Partial<ThemeChoice>;

type Selection = {
  draft: DraftId;
  theme: PresetKey;
  state: ProfileStateId;
  device: Device;
  overrides: Overrides;
};

export type BoardParams = Record<string, string | undefined>;

const pick = <T extends string>(
  value: string | undefined,
  options: Record<T, unknown>,
  fallback: T,
): T => (value && value in options ? (value as T) : fallback);

const oneOf = <T extends string>(
  value: string | undefined,
  options: readonly T[],
) => options.find((o) => o === value);

function parseSelection(p: BoardParams): Selection {
  const state =
    profileStates.find((s) => s.id === p.state)?.id ?? profileStates[0].id;
  return {
    draft: pick(p.draft, drafts, "headliner"),
    theme: pick(p.theme, presets, "atmos"),
    state,
    device: pick(p.device, devices, "desktop"),
    overrides: {
      ground: isHex(p.ground) ? p.ground : undefined,
      accent: isHex(p.accent) ? p.accent : undefined,
      display: p.face && p.face in faces ? (p.face as FaceKey) : undefined,
      corners: oneOf<Corners>(p.corners, ["hard", "soft"]),
      photo: oneOf<PhotoTreatment>(p.photo, ["color", "mono", "duotone"]),
    },
  };
}

function toQuery(sel: Selection, extra: Record<string, string> = {}) {
  const { overrides: o } = sel;
  const q = new URLSearchParams({
    ...extra,
    draft: sel.draft,
    theme: sel.theme,
    state: sel.state,
    device: sel.device,
  });
  if (o.ground) q.set("ground", o.ground);
  if (o.accent) q.set("accent", o.accent);
  if (o.display) q.set("face", o.display);
  if (o.corners) q.set("corners", o.corners);
  if (o.photo) q.set("photo", o.photo);
  return q.toString();
}

const themeChoice = (sel: Selection): ThemeChoice =>
  sel.state === "unclaimed"
    ? presets.atmos
    : { ...presets[sel.theme], ...stripUndefined(sel.overrides) };

const stripUndefined = (o: Overrides) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

// ---------------------------------------------------------------------------
// Frame: one draft as a visitor sees it

let mountedAt: number | null = null;
const getMountedAt = () => (mountedAt ??= Date.now());
const noSubscribe = () => () => undefined;
const getEmbedded = () => window.self !== window.top;

/** Board and frame talk over postMessage so a theme change never reloads the page. */
type FrameMessage =
  { type: "cp-ready" } | { type: "cp-theme"; choice: ThemeChoice };

const isFrameMessage = (data: unknown): data is FrameMessage =>
  typeof data === "object" && data !== null && "type" in data;

/**
 * One profile draft on its own, inside the iframe. Renders after mount so the
 * sample dates can be relative to now without a hydration mismatch. Embedded
 * in the board it takes its theme from the board; opened in a tab, from the URL.
 */
function FrameView({ sel }: { sel: Selection }) {
  const now = useSyncExternalStore(noSubscribe, getMountedAt, () => null);
  const embedded = useSyncExternalStore(noSubscribe, getEmbedded, () => false);
  const [pushed, setPushed] = useState<ThemeChoice | null>(null);

  useEffect(() => {
    const onMessage = (e: MessageEvent<unknown>) => {
      if (e.origin !== window.location.origin || !isFrameMessage(e.data))
        return;
      if (e.data.type === "cp-theme") setPushed(e.data.choice);
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage(
      { type: "cp-ready" } satisfies FrameMessage,
      window.location.origin,
    );
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const profile = useMemo(
    () => (now === null ? null : buildProfile(sel.state, now)),
    [sel.state, now],
  );
  const choice = pushed ?? (embedded ? null : themeChoice(sel));
  if (!choice) return <div className="h-dvh bg-black" />;
  const theme = resolveTheme(choice);
  const Draft = drafts[sel.draft].Component;

  return (
    <div
      id="cp-scroll"
      className={cn(
        "site cp relative h-dvh overflow-x-hidden overflow-y-auto",
        profileFontVariables,
      )}
      style={themeVars(theme)}
      data-tone={theme.tone}
      data-photo={theme.photo}
      data-corners={theme.corners}
    >
      <ProfileHeader tone={theme.tone} />
      <main>
        {profile ? <Draft profile={profile} /> : <div className="h-dvh" />}
      </main>
      <SiteFooter />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Board

const chip = (active: boolean) =>
  cn(
    "h-8 shrink-0 rounded-full px-3 text-[12px] transition-colors disabled:opacity-40",
    active
      ? "bg-white text-black"
      : "text-white/65 hover:bg-white/10 hover:text-white",
  );

const groupLabel =
  "mr-1 shrink-0 font-mono text-[10px] text-white/45 uppercase";

function Board({ initial }: { initial: Selection }) {
  const [sel, setSel] = useState(initial);
  const [customOpen, setCustomOpen] = useState(
    Object.values(initial.overrides).some(Boolean),
  );
  const set = (patch: Partial<Selection>) =>
    setSel((s) => ({ ...s, ...patch }));
  const setOverride = (patch: Overrides) =>
    setSel((s) => ({ ...s, overrides: { ...s.overrides, ...patch } }));

  useEffect(() => {
    window.history.replaceState(null, "", `?${toQuery(sel)}`);
  }, [sel]);

  const draft = drafts[sel.draft];
  const state = profileStates.find((s) => s.id === sel.state)!;
  const locked = sel.state === "unclaimed";
  const choice = useMemo(() => themeChoice(sel), [sel]);
  const resolved = resolveTheme(choice);
  // The iframe only reloads for draft, state or device; themes arrive by message.
  const frameSrc = `/ui-test/creator-profile?${new URLSearchParams({
    view: "frame",
    draft: sel.draft,
    state: sel.state,
  }).toString()}`;
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const send = () =>
      frameRef.current?.contentWindow?.postMessage(
        { type: "cp-theme", choice } satisfies FrameMessage,
        window.location.origin,
      );
    send();
    const onMessage = (e: MessageEvent<unknown>) => {
      if (
        e.origin === window.location.origin &&
        isFrameMessage(e.data) &&
        e.data.type === "cp-ready"
      )
        send();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [choice]);
  const width = devices[sel.device].width;
  const hasOverrides = Object.values(sel.overrides).some(Boolean);

  return (
    <div className={cn("site flex h-dvh flex-col", profileFontVariables)}>
      <div className="glass-dark sticky top-0 z-50 shrink-0 space-y-3 border-x-0 border-t-0 px-5 py-3 md:px-10">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <p className="t-label text-[12px]">Creator profile mocks</p>
          <div
            className="flex items-center gap-1"
            role="radiogroup"
            aria-label="Draft"
          >
            {(Object.keys(drafts) as DraftId[]).map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={sel.draft === id}
                onClick={() => set({ draft: id })}
                className={chip(sel.draft === id)}
              >
                {drafts[id].label}
              </button>
            ))}
          </div>
          <div
            className="flex items-center gap-1"
            role="radiogroup"
            aria-label="Profile state"
          >
            <span className={groupLabel}>Profile</span>
            {profileStates.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={sel.state === s.id}
                onClick={() => set({ state: s.id })}
                className={chip(sel.state === s.id)}
              >
                {s.label}
              </button>
            ))}
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
                aria-checked={sel.device === d}
                onClick={() => set({ device: d })}
                className={chip(sel.device === d)}
              >
                {devices[d].label}
              </button>
            ))}
            <a
              href={`/ui-test/creator-profile?${toQuery(sel, { view: "frame" })}`}
              target="_blank"
              rel="noreferrer"
              aria-label="Open this draft on its own in a new tab"
              className="ml-1 flex size-8 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
            >
              <ExternalLink className="size-4" />
            </a>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/10 pt-3">
          <div
            className="flex flex-wrap items-center gap-1"
            role="radiogroup"
            aria-label="Theme"
          >
            <span className={groupLabel}>Theme</span>
            {(Object.keys(presets) as PresetKey[]).map((key) => {
              const p = presets[key];
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={sel.theme === key}
                  disabled={locked}
                  onClick={() => set({ theme: key, overrides: {} })}
                  className={cn(
                    chip(sel.theme === key && !hasOverrides),
                    "flex items-center gap-2 pl-1.5",
                  )}
                >
                  <span
                    aria-hidden
                    className="relative size-5 overflow-hidden rounded-full ring-1 ring-white/25"
                    style={{ background: p.ground }}
                  >
                    <span
                      className="absolute right-0 bottom-0 size-2.5 rounded-tl-full"
                      style={{ background: p.accent }}
                    />
                  </span>
                  {p.name}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            aria-expanded={customOpen}
            disabled={locked}
            onClick={() => setCustomOpen((o) => !o)}
            className={cn(chip(customOpen), "flex items-center gap-2")}
          >
            <SlidersHorizontal className="size-3.5" />
            Customise{hasOverrides ? " ·" : ""}
          </button>
        </div>

        {customOpen && !locked ? (
          <Customise
            choice={choice}
            resolved={resolved}
            onChange={setOverride}
            onReset={hasOverrides ? () => set({ overrides: {} }) : undefined}
          />
        ) : null}

        <p className="pb-1 text-[12px] text-white/50">
          <span className="font-mono text-white/40">
            /@{sel.state === "unclaimed" ? "kraayjoy" : "broderbeats"}
          </span>{" "}
          · {draft.note} · <span className="text-white/65">{state.hint}</span>
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-black">
        {width ? (
          <div className="flex justify-center px-5 py-10">
            <div
              className={cn(
                "overflow-hidden border-[6px] border-white/10 bg-black",
                sel.device === "phone" ? "rounded-[40px]" : "rounded-[28px]",
              )}
              style={{ width: width + 12 }}
            >
              <iframe
                ref={frameRef}
                key={`${frameSrc}-${sel.device}`}
                title={`${draft.label}, ${state.label}`}
                src={frameSrc}
                className="block bg-black"
                style={{ width, height: sel.device === "phone" ? 844 : 1180 }}
              />
            </div>
          </div>
        ) : (
          <iframe
            ref={frameRef}
            key={`${frameSrc}-${sel.device}`}
            title={`${draft.label}, ${state.label}`}
            src={frameSrc}
            className="block size-full bg-black"
          />
        )}
      </div>
    </div>
  );
}

/** The five theme choices a creator would make, live on the current preset. */
function Customise({
  choice,
  resolved,
  onChange,
  onReset,
}: {
  choice: ThemeChoice;
  resolved: ReturnType<typeof resolveTheme>;
  onChange: (patch: Overrides) => void;
  onReset?: () => void;
}) {
  const swatch = (color: string, active: boolean, onClick: () => void) => (
    <button
      key={color}
      type="button"
      aria-label={color}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "size-6 rounded-full ring-offset-2 ring-offset-black transition-shadow",
        active ? "ring-2 ring-white" : "ring-1 ring-white/25",
      )}
      style={{ background: color }}
    />
  );

  return (
    <div className="grid gap-x-8 gap-y-3 border-t border-white/10 pt-3 text-[12px] lg:grid-cols-[auto_auto_1fr]">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={groupLabel}>Ground</span>
        {groundSwatches.map((c) =>
          swatch(c, choice.ground === c, () => onChange({ ground: c })),
        )}
        <input
          type="color"
          aria-label="Custom ground colour"
          value={choice.ground}
          onChange={(e) => onChange({ ground: e.target.value })}
          className="ml-1 size-7 cursor-pointer rounded-full border border-white/20 bg-transparent"
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={groupLabel}>Accent</span>
        {accentSwatches.map((c) =>
          swatch(c, choice.accent === c, () => onChange({ accent: c })),
        )}
        <input
          type="color"
          aria-label="Custom accent colour"
          value={choice.accent}
          onChange={(e) => onChange({ accent: e.target.value })}
          className="ml-1 size-7 cursor-pointer rounded-full border border-white/20 bg-transparent"
        />
      </div>
      <p className="self-center text-white/45 lg:text-right">
        Derived: text {resolved.ink}, text on accent {resolved.accentInk}
        {resolved.accentText !== resolved.accent
          ? ", accent too faint as text so headings use ink"
          : ""}
      </p>
      <div className="flex flex-wrap items-center gap-1 lg:col-span-3">
        <span className={groupLabel}>Display</span>
        {(Object.keys(faces) as FaceKey[]).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={choice.display === k}
            onClick={() => onChange({ display: k })}
            className={chip(choice.display === k)}
            style={{
              fontFamily: faces[k].family,
              fontStretch: faces[k].stretch,
              fontWeight: faces[k].weight,
            }}
          >
            {faces[k].label}
          </button>
        ))}
        <span className={cn(groupLabel, "ml-4")}>Corners</span>
        {(["hard", "soft"] as const).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={choice.corners === c}
            onClick={() => onChange({ corners: c })}
            className={cn(chip(choice.corners === c), "capitalize")}
          >
            {c}
          </button>
        ))}
        <span className={cn(groupLabel, "ml-4")}>Photos</span>
        {(["color", "mono", "duotone"] as const).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={choice.photo === p}
            onClick={() => onChange({ photo: p })}
            className={cn(chip(choice.photo === p), "capitalize")}
          >
            {p === "color" ? "Colour" : p}
          </button>
        ))}
        {onReset ? (
          <button
            type="button"
            onClick={onReset}
            className={cn(chip(false), "ml-auto flex items-center gap-1.5")}
          >
            <RotateCcw className="size-3.5" /> Reset to preset
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Mock board for the creator profile redesign. `view=frame` renders one draft on its own. */
export function CreatorProfileBoard({ params }: { params: BoardParams }) {
  const sel = parseSelection(params);
  return params.view === "frame" ? (
    <FrameView sel={sel} />
  ) : (
    <Board initial={sel} />
  );
}
