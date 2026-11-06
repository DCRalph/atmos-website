"use client";

import { Pencil } from "lucide-react";
import { cn } from "~/lib/utils";
import { useProfileEditor } from "./context";

/**
 * While the page editor is open, covers a layout's hero (its nearest
 * positioned parent) so a click anywhere on it opens the name, photos and bio
 * panel instead of following its links. Renders nothing otherwise.
 */
export function HeroEditButton({ className }: { className?: string }) {
  const editor = useProfileEditor();
  if (!editor?.editing) return null;
  return (
    <button
      type="button"
      onClick={editor.editProfile}
      className={cn(
        "group/hero absolute inset-0 z-20 cursor-pointer outline-2 -outline-offset-4 outline-transparent transition-[outline-color] outline-dashed hover:outline-[var(--ed-line)] focus-visible:outline-[var(--ed-line)]",
        className,
      )}
    >
      <span className="t-label absolute top-20 right-5 inline-flex h-9 items-center gap-2 rounded-full bg-black/70 px-4 text-[10px] text-white shadow-[0_0_0_1px_rgb(255_255_255/0.18)] backdrop-blur-md transition-colors group-hover/hero:bg-[var(--ed)] group-hover/hero:text-black md:top-24 md:right-10">
        <Pencil className="size-3.5" /> Name, photos and bio
      </span>
    </button>
  );
}
