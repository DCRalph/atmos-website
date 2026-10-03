"use client";

import { useState, type ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";
import { ArrowDown, Plus } from "lucide-react";
import { cn } from "~/lib/utils";
import { formatPrice, useBoard } from "../board-state";
import { photos } from "../fixtures";
import { Button, Media } from "../primitives";
import {
  Bone,
  CartSummary,
  CatalogEmpty,
  CatalogError,
  catalogFor,
  isSoldOut,
  SizeChips,
  useAddVariant,
  useRetryableState,
  type Product,
  type Size,
} from "./merch-kit";
import type { PageSpec } from "./types";

const TAGLINE = "Limited drops and Atmos staples";
const cuts = ["All", "Guys", "Girls"] as const;
type Cut = (typeof cuts)[number];

const soldOutLine = (p: Product) =>
  isSoldOut(p)
    ? "Sold out"
    : p.soldOut.length
      ? `${p.soldOut.join(", ")} sold out`
      : null;

/** Loaded, empty or error body shared by every draft; `grid` renders the products. */
function CatalogBody({
  view,
  retry,
  products,
  skeleton,
  grid,
}: {
  view: string;
  retry: () => void;
  products: readonly Product[];
  skeleton: ReactNode;
  grid: (products: readonly Product[]) => ReactNode;
}) {
  if (view === "loading") return <div aria-busy>{skeleton}</div>;
  if (view === "empty") return <CatalogEmpty />;
  if (view === "error")
    return (
      <div className="px-5 md:px-10">
        <CatalogError onRetry={retry} />
      </div>
    );
  return (
    <div className="animate-in fade-in-0 duration-300">{grid(products)}</div>
  );
}

function CutFilter({
  value,
  onChange,
  count,
}: {
  value: Cut;
  onChange: (c: Cut) => void;
  count: number;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-y border-white/10 px-5 py-3 md:px-10">
      <div className="flex gap-1" role="radiogroup" aria-label="Filter">
        {cuts.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value === c}
            onClick={() => onChange(c)}
            className={cn(
              "mx-label h-8 rounded-full px-4 text-[10px] transition-colors",
              value === c
                ? "bg-white text-black"
                : "text-white/65 hover:text-white",
            )}
          >
            {c}
          </button>
        ))}
      </div>
      <p className="mx-label mx-num text-[10px] text-white/55">
        {count} {count === 1 ? "product" : "products"}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// A · Catalogue: title, filter bar, then a four-up grid with sizes on every card.

function CatalogueCard({ product }: { product: Product }) {
  const add = useAddVariant();
  const [size, setSize] = useState<Size | null>(null);
  const out = isSoldOut(product);
  const note = soldOutLine(product);
  return (
    <article className="flex min-w-0 flex-col">
      <a
        href="#"
        className="group relative block overflow-hidden"
        aria-label={`${product.name}, ${product.colour}`}
      >
        <Media
          src={product.image}
          alt={`${product.name} in ${product.colour}`}
          sizes="(min-width: 1024px) 25vw, 50vw"
          className={cn(
            "aspect-[4/5] transition-transform duration-500 ease-out group-hover:scale-[1.03]",
            out && "grayscale",
          )}
        />
        {out ? (
          <span className="mx-label absolute top-3 left-3 rounded-[var(--mx-r-chip)] bg-white px-2 py-1.5 text-[10px] text-black">
            Sold out
          </span>
        ) : null}
      </a>
      <div className="flex flex-col gap-1.5 pt-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
        <h2 className="mx-display min-w-0 text-[15px] md:text-lg">
          <a href="#" className="hover:text-[var(--mx-accent-text)]">
            {product.name}
          </a>
        </h2>
        <p className="mx-display mx-num shrink-0 text-[15px] md:text-lg">
          {formatPrice(product.price)}
        </p>
      </div>
      <p className="mt-1.5 text-[13px] text-white/60">
        {product.colour}
        {note && !out ? <> · {note}</> : null}
      </p>
      {out ? null : (
        <div className="mt-4">
          <SizeChips
            small
            value={size}
            onChange={setSize}
            soldOut={product.soldOut}
          />
        </div>
      )}
      <Button
        className="mt-4 w-full px-3"
        variant={size ? "solid" : "outline"}
        disabled={out || !size}
        onClick={() => {
          if (!size) return;
          add({
            name: product.name,
            colour: product.colour,
            size,
            price: product.price,
            image: product.image,
          });
          setSize(null);
        }}
      >
        {out ? "Sold out" : size ? `Add ${size}` : "Pick a size"}
      </Button>
    </article>
  );
}

function CatalogueSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 px-5 pt-8 md:px-10 lg:grid-cols-4 lg:gap-x-6">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="space-y-3">
          <div className="aspect-[4/5] bg-white/[0.06]" />
          <Bone className="h-5 w-3/4" />
          <Bone className="h-3.5 w-1/3" />
          <div className="flex gap-1.5 pt-2">
            {Array.from({ length: 4 }, (_, j) => (
              <Bone key={j} className="h-8 w-10" />
            ))}
          </div>
          <Bone className="h-11 w-full" />
        </div>
      ))}
    </div>
  );
}

function CatalogueDraft({ state }: { state: string }) {
  const [view, retry] = useRetryableState(state);
  const [cut, setCut] = useState<Cut>("All");
  const products = catalogFor(view).filter(
    (p) => cut === "All" || p.name.startsWith(cut),
  );
  const ready = view === "loaded" || view === "sold-out";
  return (
    <div className="pb-20">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6 px-5 pt-12 pb-8 md:px-10 md:pt-20 md:pb-12">
        <div>
          <h1 className="mx-display text-[clamp(2.75rem,9vw,7rem)]">Merch</h1>
          <p className="mt-5 text-[16px] text-white/65 md:text-[17px]">
            {TAGLINE}
          </p>
        </div>
        <CartSummary />
      </div>
      {ready ? (
        <CutFilter value={cut} onChange={setCut} count={products.length} />
      ) : null}
      <CatalogBody
        view={view}
        retry={retry}
        products={products}
        skeleton={<CatalogueSkeleton />}
        grid={(list) => (
          <div className="grid grid-cols-2 gap-x-4 gap-y-12 px-5 pt-8 md:px-10 lg:grid-cols-4 lg:gap-x-6">
            {list.map((p) => (
              <CatalogueCard key={p.handle} product={p} />
            ))}
          </div>
        )}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// B · Lookbook: gig photo hero, then big uncropped shots with a glass plate and
// quick add from a size popover.

function LookbookTile({ product }: { product: Product }) {
  const add = useAddVariant();
  const { portalContainer } = useBoard();
  const [open, setOpen] = useState(false);
  const out = isSoldOut(product);
  const note = soldOutLine(product);
  return (
    <article className="group relative aspect-[5/4] overflow-hidden">
      <Media
        src={product.image}
        alt={`${product.name} in ${product.colour}`}
        sizes="(min-width: 640px) 50vw, 100vw"
        className={cn(
          "absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.02]",
          out && "grayscale",
        )}
      />
      {out ? (
        <span className="mx-label absolute top-3 left-3 rounded-[var(--mx-r-chip)] bg-white px-2 py-1.5 text-[10px] text-black">
          Sold out
        </span>
      ) : null}
      <div className="mx-glass-dark absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-[var(--mx-r-panel)] bg-black/60 p-3 pl-4 md:inset-x-4 md:bottom-4">
        <div className="min-w-0 flex-1">
          <h2 className="mx-display truncate text-base md:text-xl">
            <a href="#">{product.name}</a>
          </h2>
          <p className="mt-1.5 truncate text-[13px] text-white/70">
            {product.colour} ·{" "}
            <span className="mx-num text-white">
              {formatPrice(product.price)}
            </span>
            {note && !out ? <> · {note}</> : null}
          </p>
        </div>
        {out ? (
          <span className="mx-label shrink-0 pr-2 text-[10px] text-white/60">
            Sold out
          </span>
        ) : (
          <Popover.Root open={open} onOpenChange={setOpen}>
            <Popover.Trigger asChild>
              <button
                type="button"
                aria-label={`Add ${product.name} ${product.colour}`}
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-black transition-colors hover:bg-[var(--mx-accent)] hover:text-[var(--mx-accent-ink)] data-[state=open]:bg-[var(--mx-accent)] data-[state=open]:text-[var(--mx-accent-ink)]"
              >
                <Plus className="size-5" />
              </button>
            </Popover.Trigger>
            <Popover.Portal container={portalContainer}>
              <Popover.Content
                side="top"
                align="end"
                sideOffset={10}
                className="mx-glass-dark mx-float data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 z-[90] w-[260px] rounded-[var(--mx-r-panel)] rounded-br-none p-4 outline-none"
              >
                <p className="mx-label mb-3 text-[11px]">Pick a size</p>
                <SizeChips
                  small
                  value={null}
                  soldOut={product.soldOut}
                  onChange={(size) => {
                    add({
                      name: product.name,
                      colour: product.colour,
                      size,
                      price: product.price,
                      image: product.image,
                    });
                    setOpen(false);
                  }}
                />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        )}
      </div>
    </article>
  );
}

function LookbookDraft({ state }: { state: string }) {
  const [view, retry] = useRetryableState(state);
  const products = catalogFor(view);
  const ready = view === "loaded" || view === "sold-out";
  return (
    <div className="pb-20">
      <section className="relative flex h-[68svh] min-h-[480px] items-end">
        <Media
          src={photos.crowd}
          alt="Crowd at an Atmos gig"
          sizes="100vw"
          priority
          className="absolute inset-0"
        />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/75 to-transparent" />
        <div className="mx-scrim-bottom absolute inset-0" />
        <div className="relative flex w-full flex-wrap items-end justify-between gap-6 px-5 pb-8 md:px-10 md:pb-12">
          <div>
            <h1 className="mx-display text-[clamp(3.5rem,14vw,11rem)]">
              Merch
            </h1>
            <p className="mt-4 text-[16px] text-white/75 md:text-[18px]">
              {TAGLINE}
            </p>
          </div>
          {ready ? (
            <a
              href="#lookbook"
              className="mx-glass mx-label inline-flex h-11 items-center gap-2 rounded-full px-5 text-[12px] hover:bg-white/15"
            >
              Shop the tees <ArrowDown className="size-4" />
            </a>
          ) : null}
        </div>
      </section>
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4 md:px-10">
        <p className="mx-label mx-num text-[11px] text-white/60">
          {ready
            ? `${products.length} tees · ${formatPrice(products[0]?.price ?? 0)} each`
            : null}
        </p>
        <CartSummary />
      </div>
      <div id="lookbook" className="scroll-mt-4 pt-6 md:pt-10">
        <CatalogBody
          view={view}
          retry={retry}
          products={products}
          skeleton={
            <div className="grid gap-4 px-5 sm:grid-cols-2 md:px-10 lg:gap-6">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="aspect-[5/4] bg-white/[0.06]" />
              ))}
            </div>
          }
          grid={(list) => (
            <div className="grid gap-4 px-5 sm:grid-cols-2 md:px-10 lg:gap-6">
              {list.map((p) => (
                <LookbookTile key={p.handle} product={p} />
              ))}
            </div>
          )}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// C · Line sheet: dense rows you can buy from directly, with a big sticky
// preview of whichever row you're on (desktop).

function LineRow({
  product,
  index,
  active,
  onActive,
}: {
  product: Product;
  index: number;
  active: boolean;
  onActive: () => void;
}) {
  const add = useAddVariant();
  const [size, setSize] = useState<Size | null>(null);
  const out = isSoldOut(product);
  const note = soldOutLine(product);
  return (
    <li
      onMouseEnter={onActive}
      onFocus={onActive}
      className={cn(
        "grid grid-cols-[96px_minmax(0,1fr)] gap-x-4 gap-y-4 border-b border-white/10 py-5 transition-colors sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:items-center sm:gap-x-6",
        active && "lg:bg-white/[0.03]",
      )}
    >
      <Media
        src={product.image}
        alt=""
        sizes="120px"
        className={cn("aspect-[4/5]", out && "grayscale")}
      />
      <div className="min-w-0">
        <p className="mx-label mx-num text-[10px] text-white/45">
          {String(index + 1).padStart(2, "0")}
        </p>
        <h2 className="mx-display mt-2 text-xl md:text-2xl">
          <a href="#" className="hover:text-[var(--mx-accent-text)]">
            {product.name}
          </a>
        </h2>
        <p className="mt-1.5 text-[13px] text-white/60">
          {product.colour} ·{" "}
          <span className="mx-num text-white">
            {formatPrice(product.price)}
          </span>
          {note ? (
            <>
              {" "}
              · <span className={out ? "text-white" : undefined}>{note}</span>
            </>
          ) : null}
        </p>
        {out ? null : (
          <div className="mt-4">
            <SizeChips
              small
              value={size}
              onChange={setSize}
              soldOut={product.soldOut}
            />
          </div>
        )}
      </div>
      <Button
        size="sm"
        variant={size ? "solid" : "outline"}
        disabled={out || !size}
        className="col-span-2 h-10 sm:col-span-1"
        onClick={() => {
          if (!size) return;
          add({
            name: product.name,
            colour: product.colour,
            size,
            price: product.price,
            image: product.image,
          });
          setSize(null);
        }}
      >
        {out
          ? "Sold out"
          : size
            ? `Add ${size} · ${formatPrice(product.price)}`
            : "Pick a size"}
      </Button>
    </li>
  );
}

function LineSheetDraft({ state }: { state: string }) {
  const [view, retry] = useRetryableState(state);
  const products = catalogFor(view);
  const [active, setActive] = useState(0);
  const preview = products[active] ?? products[0];
  return (
    <div className="pb-20">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6 px-5 pt-12 pb-8 md:px-10 md:pt-20 md:pb-12">
        <div>
          <h1 className="mx-display text-[clamp(2.75rem,9vw,7rem)]">Merch</h1>
          <p className="mt-5 text-[16px] text-white/65 md:text-[17px]">
            {TAGLINE}
          </p>
        </div>
        <CartSummary />
      </div>
      <CatalogBody
        view={view}
        retry={retry}
        products={products}
        skeleton={
          <div className="grid gap-10 px-5 md:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,40%)]">
            <ul className="border-t border-white/10">
              {Array.from({ length: 4 }, (_, i) => (
                <li
                  key={i}
                  className="grid grid-cols-[96px_1fr] gap-4 border-b border-white/10 py-5 sm:grid-cols-[120px_1fr] sm:gap-6"
                >
                  <div className="aspect-[4/5] bg-white/[0.06]" />
                  <div className="space-y-3 pt-1">
                    <Bone className="h-3 w-6" />
                    <Bone className="h-6 w-2/3" />
                    <Bone className="h-3.5 w-1/3" />
                  </div>
                </li>
              ))}
            </ul>
            <div className="hidden aspect-[4/5] bg-white/[0.06] lg:block" />
          </div>
        }
        grid={(list) => (
          <div className="grid gap-10 px-5 md:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,40%)]">
            <ul className="border-t border-white/10">
              {list.map((p, i) => (
                <LineRow
                  key={p.handle}
                  product={p}
                  index={i}
                  active={i === active}
                  onActive={() => setActive(i)}
                />
              ))}
            </ul>
            {preview ? (
              <figure className="sticky top-6 hidden self-start lg:block">
                <Media
                  key={preview.handle}
                  src={preview.image}
                  alt={`${preview.name} in ${preview.colour}`}
                  sizes="40vw"
                  className={cn(
                    "animate-in fade-in-0 aspect-[4/5] duration-200",
                    isSoldOut(preview) && "grayscale",
                  )}
                />
                <figcaption className="mt-3 flex justify-between text-[13px] text-white/60">
                  <span>
                    {preview.name} · {preview.colour}
                  </span>
                  <span className="mx-num">{formatPrice(preview.price)}</span>
                </figcaption>
              </figure>
            ) : null}
          </div>
        )}
      />
    </div>
  );
}

export const merchPage: PageSpec = {
  id: "merch",
  title: "Merch",
  route: "/merch",
  nav: "Merch",
  states: [
    {
      id: "loaded",
      label: "Loaded",
      hint: "Some sizes sold out (illustrative stock)",
    },
    {
      id: "sold-out",
      label: "Product sold out",
      hint: "Every size of one tee gone",
    },
    {
      id: "loading",
      label: "Loading",
      hint: "Static skeleton while Shopify products load",
    },
    {
      id: "empty",
      label: "Empty",
      hint: "Live copy points visitors at Admin → Shopify; this speaks to shoppers",
    },
    { id: "error", label: "Error", hint: "Try again flips to loaded" },
  ],
  drafts: [
    {
      id: "a",
      label: "A · Catalogue",
      note: "Four-up grid, sizes and add on every card, cut filter and cart total in the title row.",
      Component: ({ state }) => <CatalogueDraft key={state} state={state} />,
    },
    {
      id: "b",
      label: "B · Lookbook",
      note: "Gig photo hero, then the tees uncropped at their studio ratio with glass plates and quick add.",
      heroUnderHeader: true,
      Component: ({ state }) => <LookbookDraft key={state} state={state} />,
    },
    {
      id: "c",
      label: "C · Line sheet",
      note: "Dense buyable rows; the row you're on shows large in a sticky preview on desktop.",
      Component: ({ state }) => <LineSheetDraft key={state} state={state} />,
    },
  ],
};
