/** The import wizard's four steps, in order. The rail is the only place they are named. */
export const IMPORT_STEPS = [
  { key: "source", label: "Source" },
  { key: "review", label: "Review details" },
  { key: "lineup", label: "Line-up and poster" },
  { key: "publish", label: "Publish" },
] as const;

export type ImportStep = (typeof IMPORT_STEPS)[number]["key"];
