/* eslint-disable @next/next/no-img-element -- static mocks; plain <img> keeps
   them independent of next/image host config (posters live on R2). */
import type { ComponentType, ReactNode } from "react";
import {
  BatteryFull,
  CalendarDays,
  House,
  Menu,
  Signal,
  Ticket,
  Wifi,
} from "lucide-react";
import { cn } from "~/lib/utils";
import type { MockGig } from "./fixtures";

/**
 * Phone furniture for the mobile mocks: an iPhone-sized frame (390x844), the
 * status bar, and the shared bits every direction draws with. Screens are
 * plain React styled with the site's own `.site` tokens, so what reads here
 * is what the React Native port has to reproduce.
 */

export type ScreenId =
  | "home"
  | "gigs"
  | "gig"
  | "tickets"
  | "more"
  | "scan"
  | "door";

export type Direction = {
  key: string;
  name: string;
  /** One line on what the direction is. */
  pitch: string;
  /** What it takes to build natively, beyond the shared type and tokens. */
  native: string;
  screens: Record<ScreenId, ComponentType>;
};

export const screenLabels: Record<ScreenId, string> = {
  home: "Home",
  gigs: "Gigs",
  gig: "Gig",
  tickets: "Tickets",
  more: "More",
  scan: "Door: scan",
  door: "Door: result",
};

/** Status bar height, i.e. where content starts under the dynamic island. */
export const STATUS = 54;

/** 390x844 device with the dynamic island and home indicator drawn on top. */
export function Phone({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-[844px] w-[390px] shrink-0 overflow-hidden rounded-[56px] bg-black shadow-[0_0_0_10px_#161616,0_0_0_11px_rgb(255_255_255/0.14)]">
      {children}
      <StatusBar />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-2 left-1/2 h-[5px] w-[134px] -translate-x-1/2 rounded-full bg-white"
      />
    </div>
  );
}

function StatusBar() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 z-50 flex h-[54px] items-center justify-between px-8 pt-1"
    >
      <span className="w-14 text-center text-[16px] font-semibold tabular-nums">
        9:41
      </span>
      <span className="absolute top-[11px] left-1/2 h-[37px] w-[126px] -translate-x-1/2 rounded-full bg-black" />
      <span className="flex items-center gap-1.5">
        <Signal className="size-4" strokeWidth={2.5} />
        <Wifi className="size-4" strokeWidth={2.5} />
        <BatteryFull className="size-6" strokeWidth={1.75} />
      </span>
    </div>
  );
}

/** The scrolling body of a screen. `pad` leaves room for a floating tab bar. */
export function Scroll({
  children,
  className,
  pad = 110,
}: {
  children: ReactNode;
  className?: string;
  pad?: number;
}) {
  return (
    <div
      className={cn("no-scrollbar absolute inset-0 overflow-y-auto", className)}
      style={{ paddingBottom: pad }}
    >
      {children}
    </div>
  );
}

export function Img({
  src,
  className,
  alt = "",
}: {
  src: string;
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src={src}
      alt={alt}
      className={cn("block size-full object-cover", className)}
    />
  );
}

/** Gig poster, hard-edged. TBA is the poster blurred behind "TBA", as on the site. */
export function Poster({
  gig,
  className,
  tbaClassName = "text-sm",
}: {
  gig: MockGig;
  className?: string;
  tbaClassName?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-white/5", className)}>
      <Img
        src={gig.poster}
        className={cn(gig.status === "tba" && "scale-110 blur-xl")}
      />
      {gig.status === "tba" ? (
        <>
          <div className="absolute inset-0 bg-black/40" />
          <p
            className={cn(
              "t-display absolute inset-0 flex items-center justify-center",
              tbaClassName,
            )}
          >
            TBA
          </p>
        </>
      ) : null}
    </div>
  );
}

/** Full-screen blurred poster, the ticket pages' backdrop. Static on purpose. */
export function Ambient({ src, dim = 0.55 }: { src: string; dim?: number }) {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <Img src={src} className="scale-125 blur-3xl" />
      <div className="absolute inset-0" style={{ background: `rgb(0 0 0 / ${dim})` }} />
    </div>
  );
}

export const tabs = [
  { id: "home", label: "Home", Icon: House },
  { id: "gigs", label: "Gigs", Icon: CalendarDays },
  { id: "tickets", label: "Tickets", Icon: Ticket },
  { id: "more", label: "More", Icon: Menu },
] as const;

export type TabId = (typeof tabs)[number]["id"];

/** Stand-in QR: deterministic modules with real finder patterns. */
export function MockQr({ seed, className }: { seed: string; className?: string }) {
  const n = 29;
  let h = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rand = () => {
    h = (h * 1103515245 + 12345) >>> 0;
    return (h >>> 16) & 1;
  };
  const finders: [number, number][] = [
    [0, 0],
    [n - 7, 0],
    [0, n - 7],
  ];
  const finder = (x: number, y: number) =>
    finders.some(
      ([fx, fy]) => x >= fx - 1 && x <= fx + 7 && y >= fy - 1 && y <= fy + 7,
    );
  const cells: [number, number][] = [];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) if (!finder(x, y) && rand()) cells.push([x, y]);

  return (
    <svg
      viewBox={`-1 -1 ${n + 2} ${n + 2}`}
      className={cn("block bg-white", className)}
      shapeRendering="crispEdges"
      aria-label="Ticket QR code"
    >
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />
      ))}
      {finders.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width={7} height={7} />
          <rect x={x + 1} y={y + 1} width={5} height={5} fill="#fff" />
          <rect x={x + 2} y={y + 2} width={3} height={3} />
        </g>
      ))}
    </svg>
  );
}

/** Small stretched-caps label, the site's meta voice. */
export function Label({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("t-label text-[10px] text-white/55", className)}>
      {children}
    </p>
  );
}
