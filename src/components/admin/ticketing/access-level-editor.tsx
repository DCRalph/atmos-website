"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { AdminSection } from "~/components/admin/admin-section";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { useUnsavedChangesWarning } from "~/hooks/use-unsaved-changes-warning";
import { isHexColour } from "~/lib/ticketing/pass-theme";
import {
  parsePassDesign,
  resolveTicketPassDesign,
  type PassDesign,
} from "~/lib/ticketing/pass-design";
import { PassDesignField } from "~/components/admin/ticketing/pass-design-field";

const LIST_URL = "/admin/access-levels";

type Level = RouterOutputs["accessLevels"]["byCode"];

type Form = {
  code: string;
  label: string;
  short: string;
  badgeBg: string;
  badgeFg: string;
  passDesign: PassDesign;
};

const BLANK: Form = {
  code: "",
  label: "",
  short: "",
  badgeBg: "#FFFFFF",
  badgeFg: "#000000",
  passDesign: {},
};

const fromLevel = (level: Level): Form => ({
  code: level.code,
  label: level.label,
  short: level.short,
  badgeBg: level.badgeBg,
  badgeFg: level.badgeFg,
  passDesign: parsePassDesign(level.passDesign),
});

/**
 * One access level, on its own page.
 *
 * It used to be a dialog, until the wallet pass editor with its tabs and
 * preview outgrew one. The level's own fields are few; the pass design is
 * most of the page, and it needs the room the event's Wallet tab has.
 */
export function AccessLevelEditor({ code }: { code?: string }) {
  const editing = code !== undefined;
  const level = api.accessLevels.byCode.useQuery(
    { code: code ?? "" },
    { enabled: editing },
  );
  // Rank sets how far the accent floods the band, so the preview needs to
  // know where this level sits among the others.
  const levels = api.accessLevels.list.useQuery({ includeArchived: true });

  if (editing && level.isPending) {
    return (
      <div className="px-4 py-4 sm:px-6 sm:py-5">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="mt-6 h-96 w-full" />
      </div>
    );
  }
  if (editing && !level.data) {
    return (
      <AdminSection
        title="Access level"
        backLink={{ href: LIST_URL, label: "Access levels" }}
      >
        <p className="text-muted-foreground text-sm">No such level.</p>
      </AdminSection>
    );
  }

  return (
    <AccessLevelForm
      key={level.data?.code ?? "new"}
      level={level.data}
      levels={levels.data ?? []}
    />
  );
}

function AccessLevelForm({
  level,
  levels,
}: {
  level: Level | undefined;
  levels: RouterOutputs["accessLevels"]["list"];
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const [saved, setSaved] = useState<Form>(level ? fromLevel(level) : BLANK);
  const [form, setForm] = useState<Form>(saved);
  const editing = level !== undefined;

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  const leave = async () => {
    await utils.accessLevels.list.invalidate();
    router.push(LIST_URL);
  };
  const create = api.accessLevels.create.useMutation({
    onSuccess: async () => {
      setSaved(form);
      toast.success("Level added");
      await leave();
    },
    onError: (e) => toast.error(e.message),
  });
  const update = api.accessLevels.update.useMutation({
    onSuccess: async () => {
      setSaved(form);
      toast.success("Saved");
      await utils.accessLevels.byCode.invalidate({ code: form.code });
      await leave();
    },
    onError: (e) => toast.error(e.message),
  });
  const saving = create.isPending || update.isPending;
  useUnsavedChangesWarning({ enabled: dirty && !saving });

  const rank = level?.rank ?? levels.length;
  const maxRank = Math.max(1, ...levels.map((row) => row.rank));
  const codeValid = /^[A-Z][A-Z0-9_]{1,23}$/.test(form.code.toUpperCase());
  const coloursValid = isHexColour(form.badgeBg) && isHexColour(form.badgeFg);
  const canSubmit =
    Boolean(form.label) &&
    Boolean(form.short) &&
    coloursValid &&
    (editing || codeValid);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      label: form.label,
      short: form.short,
      badgeBg: form.badgeBg,
      badgeFg: form.badgeFg,
      passDesign: form.passDesign,
    };
    if (editing) {
      update.mutate({ code: level.code, ...payload });
    } else {
      create.mutate({ code: form.code.toUpperCase(), ...payload, rank });
    }
  };

  return (
    <form onSubmit={submit}>
      <AdminSection
        title={editing ? level.label : "Add access level"}
        subtitle={
          editing
            ? "The code is written onto every ticket issued at this level, so it cannot change. Everything else can."
            : "Pick a code carefully. It is written onto every ticket issued at this level and can never be changed."
        }
        backLink={{ href: LIST_URL, label: "Access levels" }}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(LIST_URL)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || saving || !dirty}>
              {saving ? "Saving…" : editing ? "Save" : "Add level"}
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Level</CardTitle>
              <CardDescription>
                What the door sees. The badge sits on green, amber or red, so
                check it reads on all three.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="code">Code</Label>
                  <Input
                    id="code"
                    value={form.code}
                    disabled={editing}
                    onChange={(e) =>
                      setForm({ ...form, code: e.target.value.toUpperCase() })
                    }
                    placeholder="BACKSTAGE"
                    className="font-mono"
                  />
                  {!editing && form.code && !codeValid && (
                    <p className="text-destructive text-xs">
                      Letters, numbers and underscores; start with a letter.
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="label">Name</Label>
                  <Input
                    id="label"
                    value={form.label}
                    onChange={(e) =>
                      setForm({ ...form, label: e.target.value })
                    }
                    placeholder="Backstage"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="short">Short</Label>
                  <Input
                    id="short"
                    value={form.short}
                    onChange={(e) =>
                      setForm({ ...form, short: e.target.value.toUpperCase() })
                    }
                    placeholder="BACK"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <ColourField
                  id="badgeBg"
                  label="Badge background"
                  value={form.badgeBg}
                  onChange={(v) => setForm({ ...form, badgeBg: v })}
                />
                <ColourField
                  id="badgeFg"
                  label="Badge text"
                  value={form.badgeFg}
                  onChange={(v) => setForm({ ...form, badgeFg: v })}
                />
                <div
                  className="flex h-9 items-center gap-1"
                  aria-label="Badge preview"
                >
                  {["#15803d", "#b45309", "#b91c1c"].map((ground) => (
                    <span
                      key={ground}
                      className="grid h-full w-20 place-items-center"
                      style={{ backgroundColor: ground }}
                    >
                      <span
                        className="inline-block px-2 py-0.5 text-xs font-black tracking-[0.14em]"
                        style={{
                          backgroundColor: isHexColour(form.badgeBg)
                            ? form.badgeBg
                            : "#FFFFFF",
                          color: isHexColour(form.badgeFg)
                            ? form.badgeFg
                            : "#000000",
                        }}
                      >
                        {form.short || "SHORT"}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Wallet pass</CardTitle>
              <CardDescription>
                Applies to tickets at this level at every event. Anything left
                unset uses the event&apos;s own design, which is what general
                admission wants. An event can still override this level on its
                Wallet tab.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PassDesignField
                value={form.passDesign}
                onChange={(passDesign) => setForm({ ...form, passDesign })}
                inherits={[]}
                fallbackSource="from each event"
                eventName="Sample event"
                chip={
                  resolveTicketPassDesign(
                    {},
                    {
                      code: form.code,
                      short: form.short || "SHORT",
                      rank,
                      passDesign: form.passDesign,
                    },
                  ).chip
                }
                intensity={rank / maxRank}
                showChipControl
                disabled={saving}
              />
            </CardContent>
          </Card>
        </div>
      </AdminSection>
    </form>
  );
}

function ColourField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const valid = isHexColour(value);
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={isHexColour(value) ? value : "#FFFFFF"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="border-border size-9 shrink-0 cursor-pointer rounded border bg-transparent p-1"
        />
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#FFFFFF"
          className={`font-mono ${valid ? "" : "border-destructive"}`}
        />
      </div>
    </div>
  );
}
