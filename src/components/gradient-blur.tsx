// ~/components/ui/gradient-blur.tsx
import { cn } from "~/lib/utils";

interface GradientBlurProps {
  className?: string;
  direction?: "to-bottom" | "to-top";
}

export function GradientBlur({
  className,
  direction = "to-bottom",
}: GradientBlurProps) {
  const isToBottom = direction === "to-bottom";

  const layers = [
    { blur: 0.5, start: 0, mid1: 12.5, mid2: 25, end: 37.5 },
    { blur: 1, start: 12.5, mid1: 25, mid2: 37.5, end: 50 },
    { blur: 2, start: 25, mid1: 37.5, mid2: 50, end: 62.5 },
    { blur: 4, start: 37.5, mid1: 50, mid2: 62.5, end: 75 },
    { blur: 8, start: 50, mid1: 62.5, mid2: 75, end: 87.5 },
    { blur: 16, start: 62.5, mid1: 75, mid2: 87.5, end: 100 },
    { blur: 32, start: 75, mid1: 87.5, mid2: 100, end: null },
    { blur: 64, start: 87.5, mid1: 100, mid2: null, end: null },
  ];

  const getMask = (layer: (typeof layers)[number]) => {
    const { start, mid1, mid2, end } = layer;

    if (isToBottom) {
      if (mid2 === null) {
        return `linear-gradient(to bottom, rgba(0,0,0,0) ${start}%, rgba(0,0,0,1) ${mid1}%)`;
      }
      if (end === null) {
        return `linear-gradient(to bottom, rgba(0,0,0,0) ${start}%, rgba(0,0,0,1) ${mid1}%, rgba(0,0,0,1) ${mid2}%)`;
      }
      return `linear-gradient(to bottom, rgba(0,0,0,0) ${start}%, rgba(0,0,0,1) ${mid1}%, rgba(0,0,0,1) ${mid2}%, rgba(0,0,0,0) ${end}%)`;
    } else {
      // Flip percentages for to-top
      const fStart = 100 - start;
      const fMid1 = 100 - mid1;
      const fMid2 = mid2 !== null ? 100 - mid2 : null;
      const fEnd = end !== null ? 100 - end : null;

      if (fMid2 === null) {
        return `linear-gradient(to top, rgba(0,0,0,0) ${100 - start}%, rgba(0,0,0,1) ${100 - mid1}%)`;
      }
      if (fEnd === null) {
        return `linear-gradient(to top, rgba(0,0,0,0) ${100 - start}%, rgba(0,0,0,1) ${100 - mid1}%, rgba(0,0,0,1) ${fMid2}%)`;
      }
      return `linear-gradient(to top, rgba(0,0,0,0) ${100 - start}%, rgba(0,0,0,1) ${100 - mid1}%, rgba(0,0,0,1) ${fMid2}%, rgba(0,0,0,0) ${fEnd}%)`;
    }
  };

  return (
    <div className={cn("pointer-events-none", className)}>
      {layers.map((layer, i) => (
        <div
          key={i}
          className="absolute inset-0"
          style={{
            zIndex: i + 1,
            backdropFilter: `blur(${layer.blur}px)`,
            WebkitBackdropFilter: `blur(${layer.blur}px)`,
            mask: getMask(layer),
            WebkitMask: getMask(layer),
          }}
        />
      ))}
    </div>
  );
}
