import type { CSSProperties } from "react";

/**
 * Accent candidates. `fill` is the solid colour (buttons, chips), `ink` is the
 * text colour on that fill, `text` is the accent used as text on true black
 * (lifted where the fill itself is too dark to read).
 */
export const accents = {
  heritage: {
    name: "Heritage purple",
    fill: "#470082",
    ink: "#ffffff",
    text: "#b58cff",
  },
  violet: {
    name: "Electric violet",
    fill: "#8a3ffc",
    ink: "#ffffff",
    text: "#a978ff",
  },
  ultraviolet: {
    name: "UV magenta",
    fill: "#ff2fd4",
    ink: "#000000",
    text: "#ff5fe0",
  },
  acid: { name: "Acid", fill: "#c6ff33", ink: "#000000", text: "#c6ff33" },
  ice: { name: "Ice", fill: "#5ee0ff", ink: "#000000", text: "#5ee0ff" },
} as const;

export type AccentKey = keyof typeof accents;

export const accentVars = (key: AccentKey) => {
  const a = accents[key];
  return {
    "--mx-accent": a.fill,
    "--mx-accent-ink": a.ink,
    "--mx-accent-text": a.text,
  } as CSSProperties;
};

/** Display face candidates, all driven by the same `.mx-display` rules. */
type Face = {
  name: string;
  font: string;
  stretch: string;
  weight: number;
  /** Logo-style heading faces keep nav, buttons and labels on Anybody Wide. */
  headingsOnly?: boolean;
};

export const faces = {
  archivo: {
    name: "Archivo Expanded",
    font: "var(--font-mx-archivo)",
    stretch: "125%",
    weight: 800,
  },
  anybody: {
    name: "Anybody Wide",
    font: "var(--font-mx-anybody)",
    stretch: "135%",
    weight: 800,
  },
  unbounded: {
    name: "Unbounded",
    font: "var(--font-mx-unbounded)",
    stretch: "100%",
    weight: 700,
  },
  orbitron: {
    name: "Orbitron",
    font: "var(--font-mx-orbitron)",
    stretch: "100%",
    weight: 900,
    headingsOnly: true,
  },
  russo: {
    name: "Russo One",
    font: "var(--font-mx-russo)",
    stretch: "100%",
    weight: 400,
    headingsOnly: true,
  },
  oxanium: {
    name: "Oxanium",
    font: "var(--font-mx-oxanium)",
    stretch: "100%",
    weight: 800,
    headingsOnly: true,
  },
  tomorrow: {
    name: "Tomorrow",
    font: "var(--font-mx-tomorrow)",
    stretch: "100%",
    weight: 900,
    headingsOnly: true,
  },
} as const satisfies Record<string, Face>;

export type FaceKey = keyof typeof faces;

export const faceVars = (key: FaceKey) => {
  const f: Face = faces[key];
  return {
    "--mx-display-font": f.font,
    "--mx-display-stretch": f.stretch,
    "--mx-display-weight": f.weight,
    ...(f.headingsOnly
      ? {
          "--mx-label-font": faces.anybody.font,
          "--mx-label-stretch": faces.anybody.stretch,
        }
      : {}),
  } as CSSProperties;
};
