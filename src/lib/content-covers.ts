const covers = [
  "/home/atmos-10.jpg",
  "/home/atmos-6.jpg",
  "/home/atmos-8.jpg",
  "/home/atmos-46.jpg",
  "/home/atmos-17.jpg",
  "/home/atmos-9.jpg",
  "/home/atmos-15.jpg",
  "/home/atmos-1.jpg",
] as const;

/** Content has no artwork field yet; keep its photo cover stable across pages. */
export function contentCoverFor(id: string) {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return covers[hash % covers.length] ?? covers[0];
}
