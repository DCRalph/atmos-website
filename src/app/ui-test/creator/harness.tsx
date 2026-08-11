"use client";

import { useEffect, useRef, useState } from "react";
import { PublicProfileGrid } from "~/components/creator/public-profile-grid";
import { CreatorProfileHero } from "~/components/creator/creator-profile-hero";
import {
  CreatorGridEditor,
  AddBlockPopover,
} from "~/components/creator/creator-grid-editor";
import { BlockInspector } from "~/components/creator/block-inspector";
import {
  BLOCK_TYPES,
  type ClientBlock,
} from "~/components/creator/block-types";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  DEFAULT_THEME_TOKENS,
  themeToCssVars,
  type ThemeTokens,
} from "~/lib/creator-theme";
import {
  buildBlocks,
  FIXTURE_BIO,
  FIXTURE_COLS,
  FIXTURE_GIGS,
  FIXTURE_ROW_HEIGHT,
  FIXTURE_SOCIALS,
  HERO_VARIANTS,
  THEME_VARIANTS,
} from "./fixtures";

/**
 * Every section the harness can render. The audit script walks this list and
 * screenshots/measures one section per page load, so adding an entry here is
 * all it takes to put a new case under test.
 */
export const SECTIONS = [
  { id: "final-page", label: "Final page — hero + bio + all blocks" },
  { id: "blocks-populated", label: "Public blocks — default sizes, real data" },
  { id: "blocks-empty", label: "Public blocks — default sizes, empty data" },
  { id: "blocks-short", label: "Public blocks — forced to 1 and 2 rows" },
  { id: "blocks-tall", label: "Public blocks — forced to 10 rows" },
  { id: "blocks-narrow", label: "Public blocks — forced to 3 cols" },
  { id: "themes", label: "Public blocks — theme + density variants" },
  { id: "hero", label: "Hero variants" },
  { id: "editor-grid", label: "Editor — grid, real data" },
  { id: "editor-empty", label: "Editor — grid, freshly added blocks" },
  { id: "editor-inspector", label: "Editor — inspector panel, every type" },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];

type Props = {
  /** Render only this section. Omit to render all of them. */
  section?: string;
  /** Draw debug outlines around block boxes and their content. */
  outline?: boolean;
};

export function CreatorUiTestHarness({ section, outline }: Props) {
  const wanted = SECTIONS.filter((s) => !section || s.id === section);

  // The audit waits on this attribute before measuring. Without it, a page
  // whose client JS failed to load looks exactly like a page where every
  // block is empty. Written straight to the DOM rather than through state —
  // it is a signal for an external system, not something React renders from.
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    rootRef.current?.setAttribute("data-hydrated", "1");
  }, []);

  return (
    <div
      ref={rootRef}
      data-uitest-root
      data-hydrated="0"
      data-outline={outline ? "1" : "0"}
      className="bg-background text-foreground min-h-dvh"
    >
      <style>{OUTLINE_CSS}</style>

      {!section && <HarnessIndex />}

      {wanted.map((s) => (
        <Section key={s.id} id={s.id} label={s.label}>
          {renderSection(s.id)}
        </Section>
      ))}
    </div>
  );
}

function renderSection(id: SectionId) {
  switch (id) {
    case "final-page":
      return <FinalPageSection />;
    case "blocks-populated":
      return (
        <PublicPage
          blocks={buildBlocks({ data: "populated" })}
          tokens={DEFAULT_THEME_TOKENS}
        />
      );
    case "blocks-empty":
      return (
        <PublicPage
          blocks={buildBlocks({ data: "empty" })}
          tokens={DEFAULT_THEME_TOKENS}
        />
      );
    case "blocks-short":
      return (
        <>
          <Caption>Every block forced to h=1 (60px row)</Caption>
          <PublicPage
            blocks={buildBlocks({ data: "populated", forceH: 1 })}
            tokens={DEFAULT_THEME_TOKENS}
          />
          <Caption>Every block forced to h=2 (120px)</Caption>
          <PublicPage
            blocks={buildBlocks({ data: "populated", forceH: 2 })}
            tokens={DEFAULT_THEME_TOKENS}
          />
        </>
      );
    case "blocks-tall":
      return (
        <PublicPage
          blocks={buildBlocks({ data: "populated", forceH: 10 })}
          tokens={DEFAULT_THEME_TOKENS}
        />
      );
    case "blocks-narrow":
      return (
        <PublicPage
          blocks={buildBlocks({ data: "populated", forceW: 3 })}
          tokens={DEFAULT_THEME_TOKENS}
        />
      );
    case "themes":
      return (
        <>
          {THEME_VARIANTS.map((v) => (
            <div key={v.id} data-uitest-theme={v.id}>
              <Caption>{v.label}</Caption>
              <PublicPage
                blocks={buildBlocks({ data: "populated" })}
                tokens={v.tokens}
              />
            </div>
          ))}
        </>
      );
    case "hero":
      return (
        <>
          {HERO_VARIANTS.map((v) => (
            <div key={v.id} data-uitest-hero={v.id}>
              <Caption>{v.label}</Caption>
              <PageShell tokens={DEFAULT_THEME_TOKENS}>
                <CreatorProfileHero
                  displayName={v.displayName}
                  handle={v.handle}
                  tagline={v.tagline}
                  avatarFileId={v.avatarFileId}
                  bannerFileId={v.bannerFileId}
                  claimStatus={v.claimStatus}
                  accent={DEFAULT_THEME_TOKENS.accent}
                  bannerOverlay={DEFAULT_THEME_TOKENS.bannerOverlay}
                  backHref="/"
                />
                <div className="mx-auto max-w-6xl px-4 py-8">
                  <p className="text-sm opacity-60">
                    (page body starts here — check the gap above)
                  </p>
                </div>
              </PageShell>
            </div>
          ))}
        </>
      );
    case "editor-grid":
      return <EditorSection data="populated" />;
    case "editor-empty":
      return <EditorSection data="empty" />;
    case "editor-inspector":
      return <InspectorSection />;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Public page pieces
// ---------------------------------------------------------------------------

/**
 * The `.creator-page` wrapper from `app/creator/[handle]/page.tsx`, minus the
 * `min-h-dvh` (each section is a slice of a page, not a whole one).
 */
function PageShell({
  tokens,
  children,
}: {
  tokens: ThemeTokens;
  children: React.ReactNode;
}) {
  return (
    <div
      className="creator-page"
      data-uitest-page
      style={{
        ...themeToCssVars(tokens),
        background: "var(--creator-page-bg-image), var(--creator-page-bg)",
        color: "var(--creator-page-fg)",
        fontFamily: "var(--creator-body-font)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {children}
    </div>
  );
}

function PublicPage({
  blocks,
  tokens,
}: {
  blocks: ClientBlock[];
  tokens: ThemeTokens;
}) {
  return (
    <PageShell tokens={tokens}>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <PublicProfileGrid
          blocks={blocks}
          socials={FIXTURE_SOCIALS}
          gigAttributions={FIXTURE_GIGS}
          cols={FIXTURE_COLS}
          rowHeightPx={FIXTURE_ROW_HEIGHT}
          accent={tokens.accent}
          tokens={tokens}
        />
      </div>
    </PageShell>
  );
}

/** Mirrors `app/creator/[handle]/page.tsx` end to end. */
function FinalPageSection() {
  const tokens = DEFAULT_THEME_TOKENS;
  const hero = HERO_VARIANTS[0];
  return (
    <PageShell tokens={tokens}>
      <CreatorProfileHero
        displayName={hero.displayName}
        handle={hero.handle}
        tagline={hero.tagline}
        avatarFileId={hero.avatarFileId}
        bannerFileId={hero.bannerFileId}
        claimStatus={hero.claimStatus}
        accent={tokens.accent}
        bannerOverlay={tokens.bannerOverlay}
        backHref="/"
      />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div className="prose prose-invert max-w-none">
          <p>{FIXTURE_BIO}</p>
        </div>
        <PublicProfileGrid
          blocks={buildBlocks({ data: "populated" })}
          socials={FIXTURE_SOCIALS}
          gigAttributions={FIXTURE_GIGS}
          cols={FIXTURE_COLS}
          rowHeightPx={FIXTURE_ROW_HEIGHT}
          accent={tokens.accent}
          tokens={tokens}
        />
      </div>
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// Editor pieces
// ---------------------------------------------------------------------------

/**
 * The editor's own two-column shell, so the grid is measured at the width it
 * really gets (`lg:grid-cols-[minmax(0,1fr)_320px]` from
 * `creator-profile-editor.tsx`) rather than full-bleed.
 */
function EditorSection({ data }: { data: "populated" | "empty" }) {
  const [blocks, setBlocks] = useState<ClientBlock[]>(() =>
    buildBlocks({ data }),
  );
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(
    () => buildBlocks({ data })[0]?.id ?? null,
  );
  const selected = blocks.find((b) => b.id === selectedBlockId) ?? null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Layout</h2>
            <AddBlockPopover
              blocks={blocks}
              cols={FIXTURE_COLS}
              onAdd={(b) => {
                setBlocks([...blocks, b]);
                setSelectedBlockId(b.id);
              }}
            />
          </div>
          <div data-uitest-editor-grid>
            <CreatorGridEditor
              blocks={blocks}
              cols={FIXTURE_COLS}
              rowHeightPx={FIXTURE_ROW_HEIGHT}
              accent={DEFAULT_THEME_TOKENS.accent}
              selectedBlockId={selectedBlockId}
              onSelectBlock={setSelectedBlockId}
              onChange={setBlocks}
            />
          </div>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {selected ? `Block: ${selected.type}` : "Block settings"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selected ? (
                <BlockInspector
                  block={selected}
                  onChange={(nb) =>
                    setBlocks(blocks.map((b) => (b.id === nb.id ? nb : b)))
                  }
                />
              ) : (
                <p className="text-muted-foreground text-sm">
                  Click a block on the layout to configure it.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Every inspector panel at the real 320px sidebar width. */
function InspectorSection() {
  const blocks = buildBlocks({ data: "populated" });
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-wrap gap-4">
        {blocks.map((b) => (
          <div key={b.id} className="w-[320px]" data-uitest-inspector={b.type}>
            <Card>
              <CardHeader>
                <CardTitle>Block: {b.type}</CardTitle>
              </CardHeader>
              <CardContent>
                <InspectorHost block={b} />
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}

function InspectorHost({ block }: { block: ClientBlock }) {
  const [current, setCurrent] = useState(block);
  return <BlockInspector block={current} onChange={setCurrent} />;
}

// ---------------------------------------------------------------------------
// Chrome
// ---------------------------------------------------------------------------

function Section({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section data-uitest-section={id} className="border-border border-b">
      <header className="bg-muted/40 sticky top-0 z-30 border-b px-4 py-2 backdrop-blur">
        <h2 className="text-sm font-semibold tracking-wide">
          <span className="text-muted-foreground font-mono">{id}</span> —{" "}
          {label}
        </h2>
      </header>
      {children}
    </section>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground bg-background px-4 pt-4 text-xs font-medium tracking-wide uppercase">
      {children}
    </p>
  );
}

function HarnessIndex() {
  return (
    <div className="border-border border-b p-4">
      <h1 className="text-xl font-bold">Creator UI test harness</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Dev-only. {BLOCK_TYPES.length} block types across {SECTIONS.length}{" "}
        sections. Append <code className="font-mono">?section=&lt;id&gt;</code>{" "}
        to isolate one, <code className="font-mono">&amp;outline=1</code> to
        outline block boxes (red) against their content (cyan). Images are fake
        ids and render broken here; the audit script substitutes placeholders.
      </p>
      <ul className="mt-3 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <a
              data-uitest-section-id={s.id}
              className="text-primary text-sm underline underline-offset-2"
              href={`/ui-test/creator?section=${s.id}`}
            >
              {s.id}
            </a>
            <span className="text-muted-foreground text-sm"> — {s.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const OUTLINE_CSS = `
[data-outline="1"] .creator-block {
  outline: 1px dashed rgba(255, 40, 90, 0.9);
  outline-offset: -1px;
}
[data-outline="1"] .creator-block > * {
  outline: 1px dashed rgba(0, 200, 255, 0.9);
}
`;
