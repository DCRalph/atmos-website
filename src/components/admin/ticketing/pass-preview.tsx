"use client";

import { useState } from "react";

import {
  PASS_LAYOUT_INFO,
  stripSvg,
  stripTitleBox,
  type PassLayout,
  type StripBadge,
} from "~/lib/ticketing/pass-theme";
import {
  guideLinksOf,
  type ResolvedPassDesign,
} from "~/lib/ticketing/pass-design";
import { buildMediaUrl } from "~/lib/media-url";
import { Label } from "~/components/ui/label";

/**
 * The pass as Wallet lays it out, one side at a time: the front in whichever
 * layout the design picks, the back, or the event guide. A poster design can
 * also be previewed as the band it becomes on a phone before iOS 18.
 *
 * What the fields say comes from the caller: the event editor hands over a
 * sample ticket, the debugger the pass.json it has just composed. The band
 * itself is drawn by the very same `stripSvg` the pass renderer rasterises.
 */

export type PassPreviewField = { label: string; value: string };

export type PassPreviewBackRow = PassPreviewField & {
  /** Drawn as a link, the way Wallet's data detectors would. */
  link?: boolean;
  /** A stand-in for something the real pass fills from data. */
  muted?: boolean;
};

export type PassPreviewContent = {
  eventName: string;
  /** The one field in the header, beside the logo. */
  header: PassPreviewField | null;
  /** Secondary then auxiliary fields, in the order Wallet lays them out. */
  fields: PassPreviewField[];
  back: PassPreviewBackRow[];
  barcodeAlt: string;
  /** Becomes the Directions button in the guide. */
  venueAddress: string | null;
};

/** A ticket to a sample night, for editors that have no pass.json to show. */
export function samplePreviewContent(
  design: ResolvedPassDesign,
  eventName: string,
  venueAddress: string | null,
): PassPreviewContent {
  const guide = guideLinksOf(design);
  const contact = [design.venuePhone, design.venueEmail, design.venueWebsite]
    .filter(Boolean)
    .join(" · ");
  return {
    eventName: eventName || "Event name",
    header: { label: "DOORS", value: "10:00 pm" },
    fields: [
      { label: "DATE", value: "Fri 14 Aug 2026" },
      { label: "VENUE", value: "Boat shed" },
    ],
    back: [
      { label: "Event", value: eventName || "Event name" },
      { label: "Line-up", value: "From the gig's run sheet", muted: true },
      {
        label: "Address",
        value: venueAddress ?? "The venue address",
        link: true,
        muted: !venueAddress,
      },
      ...design.backRows.map((row) => ({
        label: row.label,
        value: row.value,
      })),
      ...(design.layout === "POSTER"
        ? []
        : guide.map((link) => ({
            label: link.label,
            value: link.url,
            link: true,
          }))),
      ...(design.layout !== "POSTER" && contact
        ? [{ label: "Venue", value: contact, link: true }]
        : []),
      { label: "Ticket number", value: "ATN-20471" },
      { label: "Order", value: "ATM-8812" },
      { label: "Manage", value: "Manage this ticket", link: true },
      {
        label: "Terms",
        value: "One entry per ticket. The first scan is the one that gets in.",
      },
    ],
    barcodeAlt: "ATN-20471",
    venueAddress,
  };
}

export type PassPreviewSide = "front" | "back" | "guide";

export function PassPreview({
  design,
  chip,
  intensity,
  side,
  content,
}: {
  design: ResolvedPassDesign;
  chip: StripBadge | null;
  intensity: number;
  side: PassPreviewSide;
  content: PassPreviewContent;
}) {
  const [legacy, setLegacy] = useState(false);
  const layout: PassLayout =
    legacy && design.layout === "POSTER" ? "BAND" : design.layout;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>Preview</Label>
        {design.layout === "POSTER" && side === "front" && (
          <div className="flex rounded-md border border-white/15 p-0.5 text-[11px]">
            {[false, true].map((old) => (
              <button
                key={String(old)}
                type="button"
                onClick={() => setLegacy(old)}
                aria-pressed={legacy === old}
                className={`rounded px-2 py-0.5 ${legacy === old ? "bg-white/15 text-white" : "text-white/50"}`}
              >
                {old ? "iOS 17" : "iOS 18"}
              </button>
            ))}
          </div>
        )}
      </div>
      <div
        className="relative overflow-hidden rounded-xl border border-white/10"
        style={{ backgroundColor: design.backgroundHex }}
      >
        {side === "front" ? (
          <PassFront
            design={design}
            layout={layout}
            chip={chip}
            intensity={intensity}
            content={content}
          />
        ) : side === "back" ? (
          <PassBack design={design} content={content} />
        ) : (
          <PassGuide design={design} venueAddress={content.venueAddress} />
        )}
      </div>
      <p className="text-xs text-white/40">
        {side === "front"
          ? "The band is drawn by the same code that builds the real pass. Type scales with the holder's text size."
          : side === "back"
            ? "Addresses, numbers and links are tappable on the real pass."
            : "Wallet draws the guide itself, so the buttons may differ a little."}
      </p>
    </div>
  );
}

function PassLogo({ design }: { design: ResolvedPassDesign }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {design.logoImageId ? (
        // Matches the 120x40pt slot an uploaded logo gets on the pass.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={buildMediaUrl(design.logoImageId)}
          alt=""
          className="h-6 max-w-[45%] object-contain object-left"
        />
      ) : (
        // Half-width wordmark, matching the pass's 80x25pt logo slot.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/logo/atmos-white.png"
          alt=""
          className="h-3.5 w-auto opacity-90"
        />
      )}
      {design.logoText && (
        <span
          className="truncate text-[8px] font-bold tracking-widest"
          style={{ color: design.foregroundHex }}
        >
          {design.logoText}
        </span>
      )}
    </div>
  );
}

function PassHeaderField({
  design,
  field,
}: {
  design: ResolvedPassDesign;
  field: PassPreviewField | null;
}) {
  if (!field) return null;
  return (
    <div className="min-w-0 text-right leading-none">
      <div
        className="truncate text-[8px] tracking-widest uppercase"
        style={{ color: design.labelHex }}
      >
        {field.label}
      </div>
      <div
        className="truncate text-[11px] font-semibold"
        style={{ color: design.foregroundHex }}
      >
        {field.value}
      </div>
    </div>
  );
}

function PassFields({
  design,
  fields,
}: {
  design: ResolvedPassDesign;
  fields: PassPreviewField[];
}) {
  if (fields.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2 px-3 py-3">
      {fields.map((field, index) => (
        <div key={`${field.label}-${index}`} className="min-w-0">
          <div
            className="truncate text-[8px] tracking-widest uppercase"
            style={{ color: design.labelHex }}
          >
            {field.label}
          </div>
          <div
            className="truncate text-[11px]"
            style={{ color: design.foregroundHex }}
          >
            {field.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function PassBarcode({
  design,
  alt,
}: {
  design: ResolvedPassDesign;
  alt: string;
}) {
  return (
    <div className="px-3 pb-3 text-center">
      <div
        aria-hidden
        className="mx-auto size-20 rounded-sm bg-[repeating-conic-gradient(#000_0_25%,#fff_0_50%)] bg-[length:8px_8px] p-1"
        style={{ backgroundColor: "#fff" }}
      />
      <div
        className="mt-1 truncate font-mono text-[8px]"
        style={{ color: design.labelHex }}
      >
        {alt}
      </div>
    </div>
  );
}

/** The front, as Wallet lays it out: header, artwork, fields, barcode. */
function PassFront({
  design,
  layout,
  chip,
  intensity,
  content,
}: {
  design: ResolvedPassDesign;
  layout: PassLayout;
  chip: StripBadge | null;
  intensity: number;
  content: PassPreviewContent;
}) {
  const name = content.eventName;
  const poster = design.posterImageId
    ? buildMediaUrl(design.posterImageId)
    : null;

  if (layout === "POSTER" && poster) {
    const kicker = [content.fields[0]?.value, content.header?.value]
      .filter(Boolean)
      .join(" · ")
      .toUpperCase();
    return (
      <>
        <div className="relative aspect-358/448 w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={poster}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          {design.headerShade && (
            <div className="absolute inset-x-0 top-0 h-1/3 bg-linear-to-b from-black/60 to-transparent" />
          )}
          <div className="absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-black/85 via-black/50 to-transparent" />
          <div className="absolute inset-x-3 top-3">
            <PassLogo design={design} />
          </div>
          <div className="absolute inset-x-3 bottom-3">
            <div className="truncate text-[8px] font-semibold tracking-widest text-white/75">
              {kicker}
            </div>
            <div className="line-clamp-2 text-lg leading-tight font-extrabold text-white">
              {name}
            </div>
          </div>
        </div>
        <div
          style={{ backgroundColor: design.chinHex ?? design.backgroundHex }}
        >
          <PassFields design={design} fields={content.fields.slice(1)} />
          <PassBarcode design={design} alt={content.barcodeAlt} />
        </div>
      </>
    );
  }

  if (layout === "BLUR" && poster) {
    return (
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={poster}
          alt=""
          className="absolute inset-0 h-full w-full scale-125 object-cover opacity-60 blur-md"
        />
        <div className="relative">
          <div className="flex items-end justify-between gap-3 px-3 pt-3 pb-2">
            <PassLogo design={design} />
            <PassHeaderField design={design} field={content.header} />
          </div>
          <div className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="min-w-0">
              <div
                className="text-[8px] tracking-widest"
                style={{ color: design.labelHex }}
              >
                EVENT
              </div>
              <div
                className="line-clamp-2 text-base leading-tight font-bold"
                style={{ color: design.foregroundHex }}
              >
                {name}
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={poster}
              alt=""
              className="size-14 shrink-0 rounded-md object-cover shadow-lg"
            />
          </div>
          <PassFields design={design} fields={content.fields} />
          <PassBarcode design={design} alt={content.barcodeAlt} />
        </div>
      </div>
    );
  }

  const banded = design.stripStyle !== "NONE";
  // With a chip the name is set in the lane beside it, as the server does.
  const lane = stripTitleBox(750, 196, chip);

  return (
    <>
      <div className="flex items-end justify-between gap-3 px-3 pt-3 pb-2">
        <PassLogo design={design} />
        <PassHeaderField design={design} field={content.header} />
      </div>

      <div className="relative">
        {banded && (
          <div className="relative aspect-375/98 w-full">
            {design.stripImageId && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={buildMediaUrl(design.stripImageId)}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
            <span
              aria-hidden
              className="absolute inset-0 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
              dangerouslySetInnerHTML={{
                __html: stripSvg(design, 750, 196, intensity, chip),
              }}
            />
          </div>
        )}
        {design.showTitle && (
          <div
            className={
              banded
                ? "absolute inset-y-0 left-0 flex flex-col justify-center px-3"
                : "px-3 py-4"
            }
            style={
              banded && chip
                ? { width: `${((lane.x + lane.width) / 750) * 100}%` }
                : banded
                  ? { right: 0 }
                  : undefined
            }
          >
            <div
              className="text-[8px] tracking-widest"
              style={{ color: design.labelHex }}
            >
              EVENT
            </div>
            {/* Beside a chip the server wraps the name rather than cut it. */}
            <div
              className={
                banded && chip
                  ? "line-clamp-2 text-sm leading-tight font-bold"
                  : "truncate text-base font-bold"
              }
              style={{ color: design.foregroundHex }}
            >
              {name}
            </div>
          </div>
        )}
      </div>

      <PassFields design={design} fields={content.fields} />
      <PassBarcode design={design} alt={content.barcodeAlt} />
    </>
  );
}

/** The back, as a list of rows. */
function PassBack({
  design,
  content,
}: {
  design: ResolvedPassDesign;
  content: PassPreviewContent;
}) {
  return (
    <div className="divide-y divide-white/10">
      <div className="flex items-center justify-between px-3 py-2 text-[9px] text-white/50">
        <span>
          Automatic Updates <b className="text-white">On</b>
        </span>
        {design.allowSharing ? <span>Share</span> : null}
      </div>
      {content.back.length === 0 && (
        <p className="px-3 py-4 text-[10px] text-white/50">No back fields.</p>
      )}
      {content.back.map((row, index) => (
        <div key={`${row.label}-${index}`} className="px-3 py-2">
          <div
            className="text-[8px] tracking-widest uppercase"
            style={{ color: design.labelHex }}
          >
            {row.label}
          </div>
          <div
            className={`text-[10px] leading-snug break-words whitespace-pre-wrap ${row.link ? "underline underline-offset-2" : ""} ${row.muted ? "italic opacity-60" : ""}`}
            style={{ color: row.link ? "#9d84ff" : design.foregroundHex }}
          >
            {row.value}
          </div>
        </div>
      ))}
    </div>
  );
}

/** The event guide Wallet draws on a poster pass from the links. */
function PassGuide({
  design,
  venueAddress,
}: {
  design: ResolvedPassDesign;
  venueAddress: string | null;
}) {
  const buttons = [
    ...(venueAddress ? ["Directions"] : []),
    ...guideLinksOf(design).map((link) => link.label),
    ...(design.venuePhone || design.venueEmail || design.venueWebsite
      ? ["Contact venue"]
      : []),
  ];

  return (
    <div className="space-y-3 px-3 py-3">
      <div
        className="text-[11px] font-bold"
        style={{ color: design.foregroundHex }}
      >
        Event Guide
      </div>
      {design.layout !== "POSTER" ? (
        <p className="text-[10px] text-white/50">
          Only a poster pass has a guide. On the{" "}
          {PASS_LAYOUT_INFO[design.layout].label.toLowerCase()} layout these
          links go on the back.
        </p>
      ) : buttons.length < 2 ? (
        <p className="text-[10px] text-white/50">
          Wallet shows the guide once two links are set.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {buttons.map((label) => (
          <span
            key={label}
            className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold"
            style={{ color: design.foregroundHex }}
          >
            {label}
          </span>
        ))}
        {design.transfer && design.layout === "POSTER" && (
          <span className="rounded-full border border-dashed border-white/20 px-2.5 py-1 text-[10px] text-white/50">
            Transfer, in the menu
          </span>
        )}
      </div>
    </div>
  );
}
