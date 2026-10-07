import { cn } from "~/lib/utils";
import {
  FACES,
  LAYOUTS,
  parseTheme,
  resolveTheme,
  type LayoutKey,
  type ResolvedTheme,
} from "~/lib/artist-theme";

/**
 * A theme at a glance for theme lists and pickers: a tiny drawing of its
 * layout in its colours, with the layout and face named underneath. Takes a
 * theme's stored tokens as-is. `compact` is the table-cell size, drawing only.
 */
export function ThemeSwatch({
  tokens,
  className,
  compact,
}: {
  tokens: unknown;
  className?: string;
  compact?: boolean;
}) {
  const theme = resolveTheme(parseTheme(tokens));
  return (
    <div className={className}>
      <div
        aria-hidden
        className={cn(
          "relative w-full overflow-hidden border",
          compact ? "h-8" : "h-16",
          theme.corners === "soft" ? "rounded-md" : "rounded-none",
        )}
        style={{ background: theme.ground }}
      >
        <ThemeSchematic layout={theme.layout} theme={theme} />
      </div>
      {!compact ? (
        <p className="text-muted-foreground mt-1 truncate text-[11px]">
          {LAYOUTS[theme.layout].label} · {FACES[theme.display].label}
        </p>
      ) : null}
    </div>
  );
}

/** The drawing alone, for any layout in a theme's colours (the editor's layout picker). */
export function ThemeSchematic({
  layout,
  theme,
}: {
  layout: LayoutKey;
  theme: ResolvedTheme;
}) {
  const ink = (pct: number) =>
    `color-mix(in oklab, ${theme.ink} ${pct}%, transparent)`;
  const bar = (w: string, h: number, color: string) => (
    <span
      className="block rounded-[1px]"
      style={{ width: w, height: h, background: color }}
    />
  );

  if (layout === "wall")
    return (
      <div className="flex h-full flex-col gap-1.5 p-1.5">
        {bar("100%", 9, theme.ink)}
        <div className="grid flex-1 grid-cols-5 gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="flex flex-col justify-end"
              style={{ background: ink(18) }}
            >
              {i < 2 ? bar("100%", 4, theme.accent) : null}
            </span>
          ))}
        </div>
      </div>
    );

  if (layout === "stage")
    return (
      <div className="grid h-full grid-cols-[42%_1fr]">
        <span
          className="flex flex-col justify-end gap-1 p-1.5"
          style={{ background: ink(18) }}
        >
          {bar("80%", 5, theme.ink)}
          {bar("100%", 5, theme.accent)}
        </span>
        <span className="flex flex-col gap-1.5 p-1.5">
          {bar("60%", 2, ink(40))}
          {bar("50%", 6, theme.ink)}
          {bar("100%", 3, ink(25))}
          {bar("100%", 3, ink(25))}
        </span>
      </div>
    );

  return (
    <div className="grid h-full grid-cols-[66%_1fr]">
      <span
        className="flex flex-col justify-end gap-1 p-1.5"
        style={{ background: ink(14) }}
      >
        {bar("75%", 7, theme.ink)}
        {bar("30%", 4, theme.accent)}
      </span>
      <span
        className="flex flex-col justify-center gap-1 p-1.5"
        style={{ background: ink(6) }}
      >
        {bar("100%", 3, ink(35))}
        {bar("100%", 3, ink(35))}
        {bar("100%", 3, ink(35))}
      </span>
    </div>
  );
}
