import { useEffect, useRef, useState } from "react";

const useMasonry = (dependency?: unknown) => {
  const masonryContainer = useRef<HTMLDivElement | null>(null);
  const [items, setItems] = useState<HTMLElement[]>([]);

  useEffect(() => {
    if (masonryContainer.current) {
      const masonryItem = Array.from(
        masonryContainer.current.children,
      ) as HTMLElement[];
      setItems(masonryItem);
    }
  }, [dependency]);

  useEffect(() => {
    const handleMasonry = () => {
      if (!items || items.length < 1) return;
      let gapSize = 0;
      if (masonryContainer.current) {
        gapSize = Number.parseInt(
          window
            .getComputedStyle(masonryContainer.current)
            .getPropertyValue("grid-row-gap"),
          10,
        );
      }
      items.forEach((el) => {
        let previous = el.previousSibling;
        while (previous) {
          if (previous.nodeType === 1) {
            el.style.marginTop = "0";
            if (
              previous instanceof HTMLElement &&
              elementLeft(previous) === elementLeft(el)
            ) {
              el.style.marginTop =
                -(elementTop(el) - elementBottom(previous) - gapSize) + "px";
              break;
            }
          }
          previous = previous.previousSibling;
        }
      });
    };

    handleMasonry();
    window.addEventListener("resize", handleMasonry);
    return () => {
      window.removeEventListener("resize", handleMasonry);
    };
  }, [items]);

  const elementLeft = (el: HTMLElement) => {
    return el.getBoundingClientRect().left;
  };

  const elementTop = (el: HTMLElement) => {
    return el.getBoundingClientRect().top + window.scrollY;
  };

  const elementBottom = (el: HTMLElement) => {
    return el.getBoundingClientRect().bottom + window.scrollY;
  };

  return masonryContainer;
};

export default useMasonry;