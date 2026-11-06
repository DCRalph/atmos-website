"use client";

import { useEffect, useState } from "react";
import { getImageProps } from "next/image";
import { paletteFrom, samePalette, type Palette } from "~/lib/artist-palette";

export type PhotoPalette = Palette & { src: string; label: string };

/**
 * Palettes picked from the artist's own photos, worked out in the browser
 * from small copies (through the image optimiser, so they're same-origin and
 * readable). Photos that fail to load are skipped; near-identical palettes are
 * shown once. Null until they're ready.
 */
export function usePhotoPalettes(
  photos: readonly { src: string; label: string }[],
  max = 4,
) {
  const key = photos.map((p) => p.src).join("|");
  const [palettes, setPalettes] = useState<{
    key: string;
    list: PhotoPalette[];
  } | null>(null);

  useEffect(() => {
    let live = true;
    void Promise.all(
      photos.slice(0, max * 2).map(async (photo) => {
        const pixels = await readPixels(photo.src).catch(() => null);
        return pixels ? { ...photo, ...paletteFrom(pixels) } : null;
      }),
    ).then((all) => {
      if (!live) return;
      const list: PhotoPalette[] = [];
      for (const p of all)
        if (p && !list.some((q) => samePalette(p, q)) && list.length < max)
          list.push(p);
      setPalettes({ key, list });
    });
    return () => {
      live = false;
    };
    // `key` stands for `photos`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, max]);

  return palettes?.key === key ? palettes.list : null;
}

const SIZE = 48;

async function readPixels(src: string) {
  const { props } = getImageProps({ src, alt: "", width: 64, height: 64 });
  const img = new Image();
  img.src = props.src;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, SIZE, SIZE);
  return ctx.getImageData(0, 0, SIZE, SIZE).data;
}
