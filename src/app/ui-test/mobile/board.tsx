"use client";

import "~/styles/site.css";

import { useState } from "react";
import { cn } from "~/lib/utils";
import { siteFontVariables } from "~/lib/site-fonts";
import { buttonVariants } from "~/components/site/ui";
import { deck } from "./deck";
import { ledger } from "./ledger";
import { Phone, screenLabels, type ScreenId } from "./phone";
import { poster } from "./poster";

const directions = [poster, ledger, deck];
const screenIds = Object.keys(screenLabels) as ScreenId[];

/**
 * Every screen of one direction side by side, or one screen across all three
 * directions. Each phone scrolls on its own.
 */
export function MobileBoard() {
  const [by, setBy] = useState<"direction" | "screen">("direction");
  const [dirIndex, setDirIndex] = useState(0);
  const [screen, setScreen] = useState<ScreenId>("home");
  const dir = directions[dirIndex] ?? poster;

  const frames =
    by === "direction"
      ? screenIds.map((id) => ({
          key: `${dir.key}-${id}`,
          caption: screenLabels[id],
          Screen: dir.screens[id],
        }))
      : directions.map((d, i) => ({
          key: `${d.key}-${screen}`,
          caption: `${"ABC"[i]} · ${d.name}`,
          Screen: d.screens[screen],
        }));

  const toggle = (active: boolean) =>
    buttonVariants({ variant: active ? "solid" : "outline", size: "sm" });

  return (
    <div className={cn("site min-h-dvh px-8 py-10", siteFontVariables)}>
      <header className="max-w-[1100px]">
        <h1 className="t-heading text-[44px]">App mocks</h1>

        <div className="mt-8 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={toggle(by === "direction")}
            onClick={() => setBy("direction")}
          >
            By direction
          </button>
          <button
            type="button"
            className={toggle(by === "screen")}
            onClick={() => setBy("screen")}
          >
            By screen
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {by === "direction"
            ? directions.map((d, i) => (
                <button
                  key={d.key}
                  type="button"
                  className={toggle(i === dirIndex)}
                  onClick={() => setDirIndex(i)}
                >
                  {"ABC"[i]} · {d.name}
                </button>
              ))
            : screenIds.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={toggle(id === screen)}
                  onClick={() => setScreen(id)}
                >
                  {screenLabels[id]}
                </button>
              ))}
        </div>

        {by === "direction" ? (
          <dl className="mt-6 grid max-w-[900px] gap-4 text-[15px] md:grid-cols-2">
            <div>
              <dt className="t-label text-[10px] text-white/55">Idea</dt>
              <dd className="mt-2 text-white/80">{dir.pitch}</dd>
            </div>
            <div>
              <dt className="t-label text-[10px] text-white/55">Native cost</dt>
              <dd className="mt-2 text-white/80">{dir.native}</dd>
            </div>
          </dl>
        ) : null}
      </header>

      <div className="mt-12 flex flex-wrap gap-x-14 gap-y-16">
        {frames.map(({ key, caption, Screen }) => (
          <figure key={key}>
            <Phone>
              <Screen />
            </Phone>
            <figcaption className="t-label mt-6 text-[11px] text-white/60">
              {caption}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
