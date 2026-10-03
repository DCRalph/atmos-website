"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  Pause,
  Play,
  Search,
  X,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { GlassSelect } from "../inputs";
import { GlassDialog } from "../overlays";
import { IconButton, Media } from "../primitives";
import { PageTitle } from "./chrome";
import {
  Bar,
  clock,
  ContentEmpty,
  ContentNoResults,
  contentDate,
  contentStates,
  contentYear,
  itemsFor,
  KindFilter,
  kindLabel,
  kindPlural,
  platformHome,
  platformIcon,
  Scrubber,
  usePlayer,
  type ContentEntry,
  type ContentKind,
  type ContentPlatform,
  type Player,
} from "./content-kit";
import type { PageSpec } from "./types";

const intro = "Releases, mixes and highlights from the Atmos community.";

/** Round play/pause for playable items, "Open" pill for playlists that live off-site. */
function PlayOrOpen({
  item,
  player,
  size = "md",
}: {
  item: ContentEntry;
  player: Player;
  size?: "md" | "lg";
}) {
  const Icon = platformIcon[item.platform];
  if (!item.duration) {
    return (
      <a
        href="#"
        className={cn(
          "mx-label inline-flex shrink-0 items-center gap-2 rounded-full border border-white/40 text-white transition-colors hover:border-white hover:bg-white/5",
          size === "lg" ? "h-14 px-6 text-[12px]" : "h-11 px-4 text-[10px]",
        )}
      >
        <Icon className="size-4" />
        <span className={size === "md" ? "max-sm:sr-only" : undefined}>
          Open
        </span>
        <ArrowUpRight className="size-3.5" />
      </a>
    );
  }
  const playing = player.isPlaying(item.id);
  return (
    <button
      type="button"
      aria-label={playing ? `Pause ${item.title}` : `Play ${item.title}`}
      aria-pressed={playing}
      onClick={() => player.toggle(item)}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full transition-colors",
        size === "lg" ? "size-14" : "size-11",
        playing || player.currentId === item.id
          ? "bg-[var(--mx-accent)] text-[var(--mx-accent-ink)]"
          : "bg-white text-black hover:bg-[var(--mx-accent)] hover:text-[var(--mx-accent-ink)]",
      )}
    >
      {playing ? (
        <Pause
          className={size === "lg" ? "size-6" : "size-4"}
          fill="currentColor"
        />
      ) : (
        <Play
          className={cn("ml-0.5", size === "lg" ? "size-6" : "size-4")}
          fill="currentColor"
        />
      )}
    </button>
  );
}

function PlatformTag({
  platform,
  className,
}: {
  platform: ContentPlatform;
  className?: string;
}) {
  const Icon = platformIcon[platform];
  return (
    <span
      className={cn("inline-flex items-center gap-2 text-white/70", className)}
    >
      <Icon className="size-4 shrink-0" />
      <span className="mx-label text-[10px]">{platform}</span>
    </span>
  );
}

function KindChip({
  kind,
  className,
}: {
  kind: ContentKind;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "mx-label inline-flex w-fit rounded-[var(--mx-r-chip)] border border-white/20 px-2 py-1.5 text-[9px] text-white/75",
        className,
      )}
    >
      {kindLabel[kind]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// A · Now playing

/** Featured item on a notched glass panel over its own photo. */
function FeaturePanel({
  item,
  player,
}: {
  item: ContentEntry;
  player: Player;
}) {
  return (
    <div className="mx-glass-dark animate-in fade-in-0 rounded-[var(--mx-r-panel)] rounded-tl-none p-5 duration-300 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <KindChip kind={item.kind} />
        <PlatformTag platform={item.platform} />
        <span className="mx-label mx-num text-[10px] text-white/60">
          {contentDate.format(item.date)}
        </span>
      </div>
      <h2 className="mx-display mt-5 text-[clamp(1.6rem,3vw,2.4rem)]">
        {item.title}
      </h2>
      {item.dj ? (
        <p className="mt-2 text-[15px] text-white/80">with {item.dj}</p>
      ) : null}
      <p className="mt-3 line-clamp-3 text-[14px] text-white/70">
        {item.blurb}
      </p>
      <div className="mt-6 flex items-center gap-4">
        <PlayOrOpen item={item} player={player} size="lg" />
        {item.duration ? (
          <Scrubber item={item} player={player} className="flex-1" />
        ) : null}
      </div>
      <a
        href="#"
        className="mx-label mt-5 inline-flex items-center gap-1 text-[11px] text-white/70 hover:text-white"
      >
        Open on {item.platform} <ArrowUpRight className="size-3.5" />
      </a>
    </div>
  );
}

function DropRow({ item, player }: { item: ContentEntry; player: Player }) {
  const active = player.currentId === item.id && item.duration;
  return (
    <li className="border-b border-white/10">
      <div className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-4 py-4 md:grid-cols-[72px_minmax(0,1fr)_auto] md:gap-6 lg:grid-cols-[72px_minmax(0,1fr)_96px_130px_120px_72px_120px]">
        <Media
          src={item.image}
          alt=""
          sizes="72px"
          className="aspect-square w-14 md:w-[72px]"
        />
        <div className="min-w-0">
          <p className="mx-display line-clamp-2 text-base md:truncate md:text-2xl">
            {item.title}
          </p>
          <p className="mt-1.5 truncate text-[13px] text-white/60">
            <span className="lg:hidden">
              {[
                item.dj,
                kindLabel[item.kind],
                item.platform,
                contentDate.format(item.date),
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
            <span className="max-lg:hidden">{item.blurb}</span>
          </p>
        </div>
        <KindChip kind={item.kind} className="max-lg:hidden" />
        <PlatformTag platform={item.platform} className="max-lg:hidden" />
        <span className="mx-label mx-num text-[10px] text-white/60 max-lg:hidden">
          {contentDate.format(item.date)}
        </span>
        <span className="mx-label mx-num text-[10px] text-white/60 max-lg:hidden">
          {item.duration ? clock(item.duration) : "--"}
        </span>
        <div className="justify-self-end">
          <PlayOrOpen item={item} player={player} />
        </div>
      </div>
      {active ? (
        <div className="animate-in fade-in-0 pb-5 duration-200 md:pl-[96px]">
          <Scrubber item={item} player={player} />
        </div>
      ) : null}
    </li>
  );
}

function RowSkeleton() {
  return (
    <li
      aria-hidden
      className="grid grid-cols-[56px_1fr_44px] items-center gap-4 border-b border-white/10 py-4 md:grid-cols-[72px_1fr_44px] md:gap-6"
    >
      <div className="aspect-square bg-white/[0.06]" />
      <div className="space-y-2.5">
        <Bar className="h-5 w-2/3 max-w-[340px]" />
        <Bar className="h-3.5 w-1/2 max-w-[240px] bg-white/[0.05]" />
      </div>
      <div className="size-11 rounded-full bg-white/[0.06]" />
    </li>
  );
}

function NowPlayingDraft({ state }: { state: string }) {
  const items = itemsFor(state);
  const player = usePlayer();
  const [kind, setKind] = useState<ContentKind | "all">(
    state === "no-results" ? "video" : "all",
  );
  const featured = items?.[0];
  const shown = items?.filter((i) => kind === "all" || i.kind === kind) ?? [];

  return (
    <>
      <section className="relative flex min-h-[620px] items-end overflow-hidden md:min-h-[700px]">
        <Media
          key={featured?.id}
          src={featured?.image ?? "/home/atmos-1.jpg"}
          alt=""
          sizes="100vw"
          className="absolute inset-0"
          priority
        />
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/75 to-transparent" />
        <div className="mx-scrim-bottom absolute inset-0" />
        <div className="relative grid w-full gap-8 px-5 pt-28 pb-10 md:px-10 md:pb-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:items-end">
          <div>
            <h1 className="mx-display text-[clamp(3rem,10vw,8rem)]">Content</h1>
            <p className="mt-5 max-w-[40ch] text-[16px] text-white/75 md:text-[17px]">
              {intro}
            </p>
          </div>
          {items === null ? (
            <div
              aria-hidden
              className="mx-glass-dark space-y-4 rounded-[var(--mx-r-panel)] rounded-tl-none p-6"
            >
              <Bar className="h-3 w-40" />
              <Bar className="h-8 w-4/5" />
              <Bar className="h-3.5 w-full bg-white/[0.05]" />
              <div className="flex items-center gap-4 pt-2">
                <div className="size-14 rounded-full bg-white/[0.08]" />
                <Bar className="h-1.5 flex-1" />
              </div>
            </div>
          ) : featured ? (
            <FeaturePanel item={featured} player={player} />
          ) : null}
        </div>
      </section>

      <section
        className="px-5 py-14 md:px-10 md:py-20"
        aria-busy={items === null}
      >
        <div className="mb-6 flex flex-wrap items-end justify-between gap-6">
          <h2 className="mx-display text-[clamp(2rem,4.5vw,3.5rem)]">
            Latest drops
          </h2>
          {items?.length ? (
            <KindFilter
              items={items}
              value={kind}
              onChange={setKind}
              className="max-w-full"
            />
          ) : null}
        </div>
        {items === null ? (
          <ul className="border-t border-white/10">
            {[0, 1, 2].map((i) => (
              <RowSkeleton key={i} />
            ))}
          </ul>
        ) : items.length === 0 ? (
          <ContentEmpty />
        ) : shown.length === 0 ? (
          <ContentNoResults
            body={`No ${kind === "all" ? "items" : kindPlural[kind].toLowerCase()} yet. They land here as soon as they drop.`}
            onClear={() => setKind("all")}
          />
        ) : (
          <ul className="border-t border-white/10">
            {shown.map((i) => (
              <DropRow key={i.id} item={i} player={player} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// B · Covers

function CoverCard({
  item,
  featured,
  onOpen,
  player,
}: {
  item: ContentEntry;
  featured: boolean;
  onOpen: () => void;
  player: Player;
}) {
  const playing = player.isPlaying(item.id);
  return (
    <article
      className={cn("group min-w-0", featured && "col-span-2 lg:row-span-2")}
    >
      <div className="relative">
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open ${item.title}${item.dj ? ` with ${item.dj}` : ""}`}
          className="block w-full"
        >
          <Media
            src={item.image}
            alt=""
            sizes={
              featured
                ? "(min-width: 1024px) 50vw, 100vw"
                : "(min-width: 1024px) 25vw, 50vw"
            }
            className="aspect-square transition-opacity group-hover:opacity-85"
            priority={featured}
          />
        </button>
        <span className="mx-label pointer-events-none absolute top-0 left-0 bg-black px-2.5 py-2 text-[9px] text-white">
          {kindLabel[item.kind]}
        </span>
        {item.duration ? (
          <IconButton
            label={playing ? `Pause ${item.title}` : `Play ${item.title}`}
            onClick={() => player.toggle(item)}
            className={cn(
              "absolute right-3 bottom-3",
              featured && "size-14",
              playing &&
                "border-transparent bg-[var(--mx-accent)] text-[var(--mx-accent-ink)] hover:bg-[var(--mx-accent)]",
            )}
          >
            {playing ? (
              <Pause className="size-5" fill="currentColor" />
            ) : (
              <Play className="ml-0.5 size-5" fill="currentColor" />
            )}
          </IconButton>
        ) : null}
      </div>
      {player.currentId === item.id && item.duration ? (
        <Scrubber item={item} player={player} className="mt-3" />
      ) : null}
      <h3
        className={cn(
          "mx-display mt-4",
          featured
            ? "text-[clamp(1.75rem,3.2vw,2.75rem)]"
            : "line-clamp-2 text-base sm:text-xl",
        )}
      >
        {item.title}
      </h3>
      <p className="mx-label mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-white/60">
        {item.dj ? <span className="text-white/85">{item.dj}</span> : null}
        <span>{item.platform}</span>
        <span className="mx-num">{contentDate.format(item.date)}</span>
      </p>
      {featured ? (
        <p className="mt-3 max-w-[52ch] text-[15px] text-white/70">
          {item.blurb}
        </p>
      ) : null}
    </article>
  );
}

/** Detail dialog for a cover: bigger art, blurb, transport or off-site link. */
function CoverDialog({
  item,
  onClose,
  player,
}: {
  item: ContentEntry | undefined;
  onClose: () => void;
  player: Player;
}) {
  return (
    <GlassDialog
      open={item !== undefined}
      onOpenChange={(open) => !open && onClose()}
      title={item?.title ?? ""}
      description={
        item
          ? [
              item.dj,
              kindLabel[item.kind],
              item.platform,
              contentDate.format(item.date),
            ]
              .filter(Boolean)
              .join(" · ")
          : undefined
      }
      className="max-w-[560px] overflow-y-auto"
    >
      {item ? (
        <div className="space-y-5 p-5">
          <Media
            src={item.image}
            alt=""
            sizes="560px"
            className="aspect-[16/9]"
          />
          <p className="text-[15px] text-white/75">{item.blurb}</p>
          {item.duration ? (
            <div className="flex items-center gap-4">
              <PlayOrOpen item={item} player={player} size="lg" />
              <Scrubber item={item} player={player} className="flex-1" />
            </div>
          ) : null}
          <a
            href="#"
            className={cn(
              item.duration
                ? "mx-label inline-flex items-center gap-1 text-[11px] text-white/70 hover:text-white"
                : "mx-label inline-flex h-11 items-center gap-2 rounded-full bg-white px-6 text-[12px] text-black hover:bg-white/85",
            )}
          >
            Open on {item.platform} <ArrowUpRight className="size-3.5" />
          </a>
        </div>
      ) : null}
    </GlassDialog>
  );
}

function CoversDraft({ state }: { state: string }) {
  const items = itemsFor(state);
  const player = usePlayer();
  const [kind, setKind] = useState<ContentKind | "all">(
    state === "no-results" ? "video" : "all",
  );
  const [platform, setPlatform] = useState<ContentPlatform | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const shown =
    items?.filter(
      (i) =>
        (kind === "all" || i.kind === kind) &&
        (platform === "all" || i.platform === platform),
    ) ?? [];
  const platforms = [...new Set(items?.map((i) => i.platform))];

  return (
    <div className="pb-20">
      <PageTitle title="Content" intro={intro}>
        <div className="mt-8 flex flex-wrap gap-2">
          {(["SoundCloud", "Spotify", "YouTube"] as const).map((p) => {
            const Icon = platformIcon[p];
            return (
              <a
                key={p}
                href={platformHome[p]}
                target="_blank"
                rel="noreferrer"
                className="mx-label inline-flex h-10 items-center gap-2 rounded-full border border-white/25 px-4 text-[10px] text-white/80 transition-colors hover:border-white hover:text-white"
              >
                <Icon className="size-4" /> {p}
              </a>
            );
          })}
        </div>
      </PageTitle>

      <div className="px-5 md:px-10" aria-busy={items === null}>
        {items?.length ? (
          <div className="mb-8 flex flex-wrap items-center gap-3 border-t border-white/10 pt-6">
            <KindFilter
              items={items}
              value={kind}
              onChange={setKind}
              className="min-w-0 flex-[2]"
            />
            <div className="w-full sm:w-[220px]">
              <GlassSelect
                label="Platform"
                value={platform}
                onValueChange={setPlatform}
                options={[
                  { value: "all", label: "All platforms" },
                  ...platforms.map((p) => ({ value: p, label: p })),
                ]}
              />
            </div>
          </div>
        ) : null}

        {items === null ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-10 border-t border-white/10 pt-6 sm:gap-x-4 lg:grid-cols-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                aria-hidden
                className={cn(
                  "space-y-3",
                  i === 0 && "col-span-2 lg:row-span-2",
                )}
              >
                <div className="aspect-square bg-white/[0.06]" />
                <Bar className="h-5 w-3/4" />
                <Bar className="h-3 w-1/2 bg-white/[0.05]" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <ContentEmpty />
        ) : shown.length === 0 ? (
          <ContentNoResults
            body={`No ${kind === "all" ? "items" : kindPlural[kind].toLowerCase()}${platform === "all" ? "" : ` on ${platform}`} yet.`}
            onClear={() => {
              setKind("all");
              setPlatform("all");
            }}
          />
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-4 lg:grid-cols-4">
            {shown.map((i, n) => (
              <CoverCard
                key={i.id}
                item={i}
                featured={n === 0 && kind === "all" && platform === "all"}
                onOpen={() => setOpenId(i.id)}
                player={player}
              />
            ))}
          </div>
        )}
      </div>
      <CoverDialog
        item={items?.find((i) => i.id === openId)}
        onClose={() => setOpenId(null)}
        player={player}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// C · Index

function IndexRow({
  item,
  n,
  open,
  onToggle,
  player,
}: {
  item: ContentEntry;
  n: number;
  open: boolean;
  onToggle: () => void;
  player: Player;
}) {
  const Icon = platformIcon[item.platform];
  return (
    <li className="border-b border-white/10">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="grid w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 py-4 text-left transition-colors hover:bg-white/[0.03] md:grid-cols-[40px_minmax(0,1fr)_110px_150px_120px_80px_24px] md:gap-5 md:px-2"
      >
        <span className="mx-num text-[13px] text-white/45">
          {String(n).padStart(2, "0")}
        </span>
        <span className="min-w-0">
          <span className="mx-display line-clamp-2 block text-base md:truncate md:text-xl">
            {item.title}
          </span>
          <span className="mt-1 block truncate text-[13px] text-white/60">
            <span className="md:hidden">
              {[
                item.dj,
                kindLabel[item.kind],
                item.platform,
                contentDate.format(item.date),
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
            <span className="max-md:hidden">{item.dj ?? "Atmos"}</span>
          </span>
        </span>
        <span className="mx-label text-[10px] text-white/70 max-md:hidden">
          {kindLabel[item.kind]}
        </span>
        <span className="flex items-center gap-2 text-white/70 max-md:hidden">
          <Icon className="size-4" />
          <span className="mx-label text-[10px]">{item.platform}</span>
        </span>
        <span className="mx-label mx-num text-[10px] text-white/60 max-md:hidden">
          {contentDate.format(item.date)}
        </span>
        <span className="mx-label mx-num text-[10px] text-white/60 max-md:hidden">
          {item.duration ? clock(item.duration) : "--"}
        </span>
        <ChevronDown
          className={cn(
            "size-4 text-white/60 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? (
        <div className="animate-in fade-in-0 slide-in-from-top-1 mb-5 grid gap-5 rounded-[var(--mx-r-panel)] rounded-tl-none border border-white/10 bg-white/[0.03] p-4 duration-200 sm:grid-cols-[180px_minmax(0,1fr)] md:ml-[60px] md:p-5">
          <Media
            src={item.image}
            alt=""
            sizes="(min-width: 640px) 180px, 100vw"
            className="aspect-[16/9] w-full sm:aspect-square"
          />
          <div className="flex min-w-0 flex-col gap-4">
            <p className="max-w-[60ch] text-[15px] text-white/75">
              {item.blurb}
            </p>
            {item.duration ? (
              <div className="flex items-center gap-4">
                <PlayOrOpen item={item} player={player} />
                <Scrubber item={item} player={player} className="flex-1" />
              </div>
            ) : null}
            <a
              href="#"
              className="mx-label mt-auto inline-flex w-fit items-center gap-2 rounded-full border border-white/40 px-5 py-3 text-[10px] hover:border-white hover:bg-white/5"
            >
              <Icon className="size-4" /> Open on {item.platform}{" "}
              <ArrowUpRight className="size-3.5" />
            </a>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function IndexDraft({ state }: { state: string }) {
  const items = itemsFor(state);
  const player = usePlayer();
  const [query, setQuery] = useState(state === "no-results" ? "jungle" : "");
  const [kind, setKind] = useState<ContentKind | "all">("all");
  const [openId, setOpenId] = useState<string | null>(items?.[0]?.id ?? null);

  const q = query.trim().toLowerCase();
  const shown =
    items?.filter(
      (i) =>
        (kind === "all" || i.kind === kind) &&
        (!q ||
          `${i.title} ${i.dj ?? ""} ${i.platform} ${i.blurb}`
            .toLowerCase()
            .includes(q)),
    ) ?? [];
  const years = [...new Set(shown.map((i) => contentYear(i.date)))];
  const clear = () => {
    setQuery("");
    setKind("all");
  };

  return (
    <div className="px-5 pt-12 pb-20 md:px-10 md:pt-20">
      <div className="flex items-end justify-between gap-4 border-b border-white/10 pb-8">
        <div className="min-w-0">
          <h1 className="mx-display text-[clamp(2.75rem,9vw,7rem)]">Content</h1>
          <p className="mt-5 max-w-[52ch] text-[16px] text-white/65 md:text-[17px]">
            {intro}
          </p>
        </div>
        <p className="shrink-0 text-right">
          <span className="mx-display mx-num block text-[clamp(2rem,7vw,5.5rem)] text-[var(--mx-accent-text)]">
            {items === null ? "--" : String(items.length).padStart(2, "0")}
          </span>
          <span className="mx-label mt-2 block text-[10px] text-white/60">
            Drops
          </span>
        </p>
      </div>

      {items?.length ? (
        <div className="mt-6 mb-4 flex flex-wrap items-center gap-3">
          <label className="relative min-w-[220px] flex-1">
            <span className="sr-only">Search content</span>
            <Search className="pointer-events-none absolute top-1/2 left-5 size-4 -translate-y-1/2 text-white/50" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search titles, DJs"
              className="h-12 w-full rounded-full border border-white/15 bg-white/[0.04] pr-12 pl-12 text-[15px] text-white outline-none placeholder:text-white/45 hover:border-white/30 focus:border-white/60"
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
                className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-white/60 hover:text-white"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </label>
          <KindFilter items={items} value={kind} onChange={setKind} />
        </div>
      ) : null}

      <div className="mt-6" aria-busy={items === null}>
        {items === null ? (
          <ul aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <li
                key={i}
                className="grid grid-cols-[28px_1fr] items-center gap-3 border-b border-white/10 py-5 md:grid-cols-[40px_1fr_110px_150px_120px] md:gap-5 md:px-2"
              >
                <Bar className="h-3 w-5" />
                <Bar className="h-5 w-3/5 max-w-[320px]" />
                <Bar className="h-3 w-14 max-md:hidden" />
                <Bar className="h-3 w-20 max-md:hidden" />
                <Bar className="h-3 w-20 max-md:hidden" />
              </li>
            ))}
          </ul>
        ) : items.length === 0 ? (
          <ContentEmpty />
        ) : shown.length === 0 ? (
          <ContentNoResults
            body={`Nothing for ${q ? `“${query.trim()}”` : "that filter"}${kind === "all" ? "" : ` in ${kindPlural[kind].toLowerCase()}`}. Try a DJ name or another type.`}
            onClear={clear}
          />
        ) : (
          years.map((y) => (
            <section key={y} className="mb-10 last:mb-0">
              <h2 className="mx-display mx-num border-b border-white/10 pb-3 text-2xl text-white/85">
                {y}
              </h2>
              <ul>
                {shown
                  .filter((i) => contentYear(i.date) === y)
                  .map((i) => (
                    <IndexRow
                      key={i.id}
                      item={i}
                      n={items.indexOf(i) + 1}
                      open={openId === i.id}
                      onToggle={() => setOpenId(openId === i.id ? null : i.id)}
                      player={player}
                    />
                  ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

export const contentPage: PageSpec = {
  id: "content",
  title: "Content",
  route: "/content",
  nav: "Content",
  states: contentStates,
  drafts: [
    {
      id: "a",
      label: "A · Now playing",
      note: "Latest drop plays from a glass panel over its own photo; everything else is a dense list below.",
      Component: NowPlayingDraft,
      heroUnderHeader: true,
    },
    {
      id: "b",
      label: "B · Covers",
      note: "Record-shop cover grid with type and platform filters; a cover opens its player in a dialog.",
      Component: CoversDraft,
    },
    {
      id: "c",
      label: "C · Index",
      note: "Catalogue index by year with search; rows expand into a notched detail panel.",
      Component: IndexDraft,
    },
  ],
};
