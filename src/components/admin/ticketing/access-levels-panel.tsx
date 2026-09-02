"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { useConfirm } from "~/components/confirm-provider";
import { isHexColour } from "~/lib/ticketing/pass-theme";

type Level = RouterOutputs["accessLevels"]["list"][number];

const BLANK = {
  code: "",
  label: "",
  short: "",
  badgeBg: "#FFFFFF",
  badgeFg: "#000000",
  passAccent: "",
};

/**
 * Manage access levels.
 *
 * These used to be a Prisma enum, so the two rules that survive from that are
 * enforced rather than assumed: a code is permanent once tickets carry it, and
 * a level in use is archived rather than deleted.
 */
export function AccessLevelsPanel() {
  const confirm = useConfirm();
  const utils = api.useUtils();
  const [isOpen, setIsOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [form, setForm] = useState({ ...BLANK });

  const { data, isLoading } = api.accessLevels.list.useQuery({
    includeArchived: true,
  });

  const refresh = async () => {
    await utils.accessLevels.list.invalidate();
  };
  const close = () => {
    setIsOpen(false);
    setEditingCode(null);
    setForm({ ...BLANK });
  };

  const create = api.accessLevels.create.useMutation({
    onSuccess: async () => {
      toast.success("Level added");
      await refresh();
      close();
    },
    onError: (e) => toast.error(e.message),
  });
  const update = api.accessLevels.update.useMutation({
    onSuccess: async () => {
      toast.success("Saved");
      await refresh();
      close();
    },
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

  const rows = data ?? [];

  const openEdit = (level: Level) => {
    setEditingCode(level.code);
    setForm({
      code: level.code,
      label: level.label,
      short: level.short,
      badgeBg: level.badgeBg,
      badgeFg: level.badgeFg,
      passAccent: level.passAccent ?? "",
    });
    setIsOpen(true);
  };

  const move = (index: number, delta: number) => {
    const next = [...rows];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);
    reorder.mutate({ codes: next.map((r) => r.code) });
  };

  const codeValid = /^[A-Z][A-Z0-9_]{1,23}$/.test(form.code.toUpperCase());
  const coloursValid =
    isHexColour(form.badgeBg) &&
    isHexColour(form.badgeFg) &&
    (form.passAccent === "" || isHexColour(form.passAccent));
  const canSubmit =
    Boolean(form.label) &&
    Boolean(form.short) &&
    coloursValid &&
    (editingCode !== null || codeValid);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      label: form.label,
      short: form.short,
      badgeBg: form.badgeBg,
      badgeFg: form.badgeFg,
      passAccent: form.passAccent || null,
    };
    if (editingCode) {
      update.mutate({ code: editingCode, ...payload });
    } else {
      create.mutate({
        code: form.code.toUpperCase(),
        ...payload,
        rank: rows.length,
      });
    }
  };

  const columns: DataTableColumn<Level>[] = [
    {
      id: "order",
      header: "Order",
      hideable: false,
      cell: (level) => {
        const index = rows.findIndex((r) => r.code === level.code);
        return (
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label={`Move ${level.label} up`}
              disabled={index <= 0 || reorder.isPending}
              onClick={() => move(index, -1)}
            >
              <ArrowUp className="size-3.5" aria-hidden />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label={`Move ${level.label} down`}
              disabled={index === rows.length - 1 || reorder.isPending}
              onClick={() => move(index, 1)}
            >
              <ArrowDown className="size-3.5" aria-hidden />
            </Button>
          </div>
        );
      },
    },
    {
      id: "label",
      header: "Name",
      accessor: (row) => row.label,
      className: "font-medium",
    },
    {
      id: "code",
      header: "Code",
      cell: (level) => (
        <span className="text-muted-foreground font-mono text-sm">
          {level.code}
        </span>
      ),
    },
    {
      id: "badge",
      header: "Door badge",
      cell: (level) => (
        <span
          className="inline-block px-2 py-0.5 text-xs font-black tracking-[0.14em]"
          style={{ backgroundColor: level.badgeBg, color: level.badgeFg }}
        >
          {level.short}
        </span>
      ),
    },
    {
      id: "pass",
      header: "Pass colour",
      cell: (level) =>
        level.passAccent ? (
          <div className="flex items-center gap-2">
            <div
              className="border-border size-6 rounded border"
              style={{ backgroundColor: level.passAccent }}
            />
            <span className="text-muted-foreground text-sm">
              {level.passAccent}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">Event theme</span>
        ),
    },
    {
      id: "offered",
      header: "Offered",
      cell: (level) => (
        <Switch
          checked={!level.archived}
          aria-label={`Offer ${level.label} when issuing tickets`}
          onCheckedChange={(on) =>
            setArchived.mutate({ code: level.code, archived: !on })
          }
        />
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      hideable: false,
      cell: (level) => (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => openEdit(level)}>
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={async () => {
              const ok = await confirm({
                title: `Delete ${level.label}`,
                description:
                  "Only possible if no tickets or tiers use it. Otherwise switch it off under Offered, which retires it while keeping past tickets readable.",
                confirmLabel: "Delete",
                variant: "destructive",
              });
              if (ok) remove.mutate({ code: level.code });
            }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <CardTitle>Access levels</CardTitle>
            <CardDescription>
              Lowest access first — the order decides how far a wallet pass
              floods with the level&apos;s colour, so access-all-areas belongs
              at the bottom.
            </CardDescription>
          </div>
          <Dialog
            open={isOpen}
            onOpenChange={(open) => (open ? setIsOpen(true) : close())}
          >
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  setEditingCode(null);
                  setForm({ ...BLANK });
                }}
              >
                <Plus className="size-4" aria-hidden />
                Add level
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingCode ? "Edit" : "Add"} access level
                </DialogTitle>
                <DialogDescription>
                  {editingCode
                    ? "The code is written onto every ticket issued at this level, so it cannot change. Everything else can."
                    : "Pick a code carefully — it is written onto every ticket issued at this level and can never be changed."}
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={submit} className="space-y-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="code">Code</Label>
                  <Input
                    id="code"
                    value={form.code}
                    disabled={editingCode !== null}
                    onChange={(e) =>
                      setForm({ ...form, code: e.target.value.toUpperCase() })
                    }
                    placeholder="BACKSTAGE"
                    className="font-mono"
                  />
                  {!editingCode && form.code && !codeValid && (
                    <p className="text-destructive text-xs">
                      Letters, numbers and underscores; start with a letter.
                    </p>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
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
                        setForm({
                          ...form,
                          short: e.target.value.toUpperCase(),
                        })
                      }
                      placeholder="BACK"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
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
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Preview</Label>
                  <div className="bg-muted flex items-center gap-3 p-3">
                    <span
                      className="inline-block px-3 py-1 text-sm font-black tracking-[0.14em]"
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
                    <span className="text-muted-foreground text-xs">
                      A door badge sits on green, amber or red — check it reads
                      on all three.
                    </span>
                  </div>
                </div>

                <ColourField
                  id="passAccent"
                  label="Wallet pass colour"
                  value={form.passAccent}
                  onChange={(v) => setForm({ ...form, passAccent: v })}
                  optional
                  hint="Leave empty to use the event's own theme — what general admission wants."
                />

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={close}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      !canSubmit || create.isPending || update.isPending
                    }
                  >
                    {editingCode ? "Save" : "Add level"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={rows}
          isLoading={isLoading}
          getRowId={(row) => row.code}
          storageKey="admin-access-levels"
          rowClassName={(row) => (row.archived ? "opacity-50" : undefined)}
        />
      </CardContent>
    </Card>
  );
}

function ColourField({
  id,
  label,
  value,
  onChange,
  optional = false,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
  hint?: string;
}) {
  const valid = optional
    ? value === "" || isHexColour(value)
    : isHexColour(value);
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
          placeholder={optional ? "Event theme" : "#FFFFFF"}
          className={`font-mono ${valid ? "" : "border-destructive"}`}
        />
      </div>
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}
