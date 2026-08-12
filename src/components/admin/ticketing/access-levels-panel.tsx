"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { isHexColour } from "~/lib/ticketing/pass-theme";

type Level = RouterOutputs["accessLevels"]["list"][number];

/**
 * Manage access levels.
 *
 * These used to be a Prisma enum, so the two rules that survive from that are
 * enforced here rather than assumed: a code is permanent once tickets carry it,
 * and a level in use is archived rather than deleted.
 */
export function AccessLevelsPanel() {
  const utils = api.useUtils();
  const levels = api.accessLevels.list.useQuery({ includeArchived: true });
  const [adding, setAdding] = useState(false);

  const refresh = async () => {
    await utils.accessLevels.list.invalidate();
  };

  const update = api.accessLevels.update.useMutation({
    onSuccess: refresh,
    onError: (e) => toast.error(e.message),
  });
  const setArchived = api.accessLevels.setArchived.useMutation({
    onSuccess: refresh,
    onError: (e) => toast.error(e.message),
  });
  const remove = api.accessLevels.remove.useMutation({
    onSuccess: async () => {
      toast.success("Deleted");
      await refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const reorder = api.accessLevels.reorder.useMutation({
    onSuccess: refresh,
    onError: (e) => toast.error(e.message),
  });

  if (levels.isPending) {
    return <Loader2 className="size-5 animate-spin text-white/40" />;
  }

  const rows = levels.data ?? [];

  const move = (index: number, delta: number) => {
    const next = [...rows];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);
    reorder.mutate({ codes: next.map((r) => r.code) });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <p className="max-w-prose text-sm text-white/50">
          Lowest access first — the order decides how far a wallet pass floods
          with the level&apos;s colour, so access-all-areas belongs at the
          bottom. Codes are what sit on issued tickets and cannot be changed.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => setAdding(true)}
          disabled={adding}
        >
          <Plus className="size-4" aria-hidden /> Add level
        </Button>
      </div>

      <ul className="space-y-2">
        {rows.map((level, index) => (
          <LevelRow
            key={level.code}
            level={level}
            first={index === 0}
            last={index === rows.length - 1}
            busy={update.isPending || reorder.isPending}
            onMove={(delta) => move(index, delta)}
            onSave={(patch) => update.mutate({ code: level.code, ...patch })}
            onArchive={(archived) =>
              setArchived.mutate({ code: level.code, archived })
            }
            onDelete={() => remove.mutate({ code: level.code })}
          />
        ))}
      </ul>

      {adding && (
        <NewLevel
          nextRank={rows.length}
          onDone={async () => {
            setAdding(false);
            await refresh();
          }}
          onCancel={() => setAdding(false)}
        />
      )}
    </div>
  );
}

function LevelRow({
  level,
  first,
  last,
  busy,
  onMove,
  onSave,
  onArchive,
  onDelete,
}: {
  level: Level;
  first: boolean;
  last: boolean;
  busy: boolean;
  onMove: (delta: number) => void;
  onSave: (patch: {
    label: string;
    short: string;
    tone: string;
    passAccent: string | null;
  }) => void;
  onArchive: (archived: boolean) => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = useState(level.label);
  const [short, setShort] = useState(level.short);
  const [tone, setTone] = useState(level.tone);
  const [accent, setAccent] = useState(level.passAccent ?? "");

  const accentValid = accent === "" || isHexColour(accent);
  const dirty =
    label !== level.label ||
    short !== level.short ||
    tone !== level.tone ||
    (accent || null) !== level.passAccent;

  return (
    <li
      className={`border-2 p-3 ${level.archived ? "border-white/10 opacity-50" : "border-white/15"}`}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={first || busy}
            aria-label="Move up"
            className="border border-white/15 p-0.5 disabled:opacity-30"
          >
            <ArrowUp className="size-3" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={last || busy}
            aria-label="Move down"
            className="border border-white/15 p-0.5 disabled:opacity-30"
          >
            <ArrowDown className="size-3" aria-hidden />
          </button>
        </div>

        <div className="space-y-1">
          <Label>Code</Label>
          <div className="flex h-9 items-center bg-white/5 px-3 font-mono text-sm text-white/50">
            {level.code}
          </div>
        </div>

        <div className="min-w-40 flex-1 space-y-1">
          <Label htmlFor={`label-${level.code}`}>Name</Label>
          <Input
            id={`label-${level.code}`}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>

        <div className="w-24 space-y-1">
          <Label htmlFor={`short-${level.code}`}>Short</Label>
          <Input
            id={`short-${level.code}`}
            value={short}
            onChange={(e) => setShort(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor={`accent-${level.code}`}>Pass colour</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Pass colour picker"
              value={isHexColour(accent) ? accent : "#7DD3FC"}
              onChange={(e) => setAccent(e.target.value)}
              className="h-9 w-9 shrink-0 cursor-pointer border-2 border-white/15 bg-transparent p-0.5"
            />
            <Input
              id={`accent-${level.code}`}
              value={accent}
              placeholder="none"
              onChange={(e) => setAccent(e.target.value)}
              className={`w-28 font-mono ${accentValid ? "" : "border-red-500"}`}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pb-1">
          <Switch
            id={`archived-${level.code}`}
            checked={!level.archived}
            onCheckedChange={(on) => onArchive(!on)}
          />
          <Label htmlFor={`archived-${level.code}`}>Offered</Label>
        </div>

        <Button
          type="button"
          disabled={!dirty || !accentValid || busy}
          onClick={() =>
            onSave({ label, short, tone, passAccent: accent || null })
          }
        >
          Save
        </Button>

        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${level.label}`}
          className="p-2 text-white/40 hover:text-red-400"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>

      <div className="mt-2 space-y-1">
        <Label htmlFor={`tone-${level.code}`}>Door badge classes</Label>
        <Input
          id={`tone-${level.code}`}
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          className="font-mono text-xs"
        />
        <p className="text-xs text-white/40">
          A solid Tailwind pair — a door badge sits on green, amber or red and
          has to stay readable on all three.{" "}
          <span className={`ml-1 px-1.5 py-0.5 text-xs font-bold ${tone}`}>
            {short || "?"}
          </span>
        </p>
      </div>
    </li>
  );
}

function NewLevel({
  nextRank,
  onDone,
  onCancel,
}: {
  nextRank: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [short, setShort] = useState("");
  const [accent, setAccent] = useState("#7DD3FC");

  const create = api.accessLevels.create.useMutation({
    onSuccess: () => {
      toast.success("Level added");
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  const codeValid = /^[A-Z][A-Z0-9_]{1,23}$/.test(code.toUpperCase());

  return (
    <div className="space-y-3 border-2 border-dashed border-white/25 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="new-code">Code</Label>
          <Input
            id="new-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="BACKSTAGE"
            className={`w-40 font-mono ${code && !codeValid ? "border-red-500" : ""}`}
          />
        </div>
        <div className="min-w-40 flex-1 space-y-1">
          <Label htmlFor="new-label">Name</Label>
          <Input
            id="new-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Backstage"
          />
        </div>
        <div className="w-24 space-y-1">
          <Label htmlFor="new-short">Short</Label>
          <Input
            id="new-short"
            value={short}
            onChange={(e) => setShort(e.target.value.toUpperCase())}
            placeholder="BACK"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="new-accent">Pass colour</Label>
          <input
            id="new-accent"
            type="color"
            value={isHexColour(accent) ? accent : "#7DD3FC"}
            onChange={(e) => setAccent(e.target.value)}
            className="h-9 w-16 cursor-pointer border-2 border-white/15 bg-transparent p-0.5"
          />
        </div>
        <Button
          type="button"
          disabled={!codeValid || !label || !short || create.isPending}
          onClick={() =>
            create.mutate({
              code: code.toUpperCase(),
              label,
              short: short || label.slice(0, 6).toUpperCase(),
              tone: "bg-white text-black",
              passAccent: accent || null,
              rank: nextRank,
            })
          }
        >
          {create.isPending ? "Adding…" : "Add"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      <p className="text-xs text-white/40">
        The code is written onto every ticket issued at this level and can never
        be changed — the name above it can.
      </p>
    </div>
  );
}
