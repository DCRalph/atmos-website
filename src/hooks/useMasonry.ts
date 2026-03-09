"use client";

import { useCallback, useEffect, useRef } from "react";

interface MasonryOptions {
  gap?: number;
  columns?: {
    default: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
}

const getBreakpointColumns = (
  columns: MasonryOptions["columns"],
  width: number
): number => {
  if (!columns) return 3;

  // Tailwind breakpoints
  if (width >= 1280 && columns.xl) return columns.xl;
  if (width >= 1024 && columns.lg) return columns.lg;
  if (width >= 768 && columns.md) return columns.md;
  if (width >= 640 && columns.sm) return columns.sm;
  return columns.default;
};

const useMasonry = <T = unknown>(
  dependency?: T,
  options: MasonryOptions = {}
) => {
  const { gap = 16, columns = { default: 1, md: 2, lg: 3, xl: 4 } } = options;
  const masonryContainer = useRef<HTMLDivElement | null>(null);

  const calculateLayout = useCallback(() => {
    const container = masonryContainer.current;
    if (!container) return;

    const items = Array.from(container.children) as HTMLElement[];
    if (items.length === 0) return;

    const containerWidth = container.offsetWidth;
    const numColumns = getBreakpointColumns(columns, containerWidth);

    // Calculate column width
    const totalGapWidth = gap * (numColumns - 1);
    const columnWidth = (containerWidth - totalGapWidth) / numColumns;

    // Track the height of each column
    const columnHeights: number[] = new Array(numColumns).fill(0);

    // Position each item
    items.forEach((item) => {
      // Find the shortest column
      const shortestColumn = columnHeights.indexOf(Math.min(...columnHeights));

      // Calculate position
      const x = shortestColumn * (columnWidth + gap);
      const y = columnHeights[shortestColumn];

      // Apply styles
      item.style.position = "absolute";
      item.style.left = `${x}px`;
      item.style.top = `${y}px`;
      item.style.width = `${columnWidth}px`;

      // Update column height
      columnHeights[shortestColumn] += item.offsetHeight + gap;
    });

    // Set container height to the tallest column
    const maxHeight = Math.max(...columnHeights) - gap;
    container.style.position = "relative";
    container.style.height = `${Math.max(0, maxHeight)}px`;
  }, [gap, columns]);

  // Recalculate on dependency change
  useEffect(() => {
    // Use requestAnimationFrame for smoother initial render
    const rafId = requestAnimationFrame(() => {
      calculateLayout();
    });

    // Also recalculate after a delay for images that might still be loading
    const timeoutId = setTimeout(() => {
      calculateLayout();
    }, 100);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
    };
  }, [dependency, calculateLayout]);

  // Handle resize
  useEffect(() => {
    const container = masonryContainer.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      calculateLayout();
    });

    resizeObserver.observe(container);

    // Also observe each child for size changes
    const items = Array.from(container.children) as HTMLElement[];
    items.forEach((item) => {
      resizeObserver.observe(item);
    });

    return () => {
      resizeObserver.disconnect();
    };
  }, [calculateLayout, dependency]);

  // Handle image loading
  useEffect(() => {
    const container = masonryContainer.current;
    if (!container) return;

    const images = container.querySelectorAll("img");

    const handleImageLoad = () => {
      calculateLayout();
    };

    images.forEach((img) => {
      if (!img.complete) {
        img.addEventListener("load", handleImageLoad);
        img.addEventListener("error", handleImageLoad);
      }
    });

    // Recalculate after all images should be loaded
    const timeoutId = setTimeout(calculateLayout, 500);

    return () => {
      images.forEach((img) => {
        img.removeEventListener("load", handleImageLoad);
        img.removeEventListener("error", handleImageLoad);
      });
      clearTimeout(timeoutId);
    };
  }, [calculateLayout, dependency]);

  // Window resize handler
  useEffect(() => {
    const handleResize = () => {
      calculateLayout();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [calculateLayout]);

  return masonryContainer;
};

export default useMasonry;
