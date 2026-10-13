"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { useConfirm } from "~/components/confirm-provider";
import { stripSvg } from "~/lib/ticketing/pass-theme";
import {
  parsePassDesign,
  resolvePassDesign,
} from "~/lib/ticketing/pass-design";

type Level = RouterOutputs["accessLevels"]["list"][number];

/**
 * Manage access levels.
 *
 * These used to be a Prisma enum, so the two rules that survive from that are
 * enforced rather than assumed: a code is permanent once tickets carry it, and
 * a level in use is archived rather than deleted. Adding and editing happen on
 * their own page (`AccessLevelEditor`), because the wallet pass editor
 * outgrew a dialog.
 */
export function AccessLevelsPanel() {
  const confirm = useConfirm();
  const utils = api.useUtils();

  const { data, isLoading } = api.accessLevels.list.useQuery({
    includeArchived: true,
  });

  const refresh = async () => {
    await utils.accessLevels.list.invalidate();
  };

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
  const maxRank = Math.max(1, ...rows.map((row) => row.rank));

  const move = (index: number, delta: number) => {
    const next = [...rows];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);
    reorder.mutate({ codes: next.map((r) => r.code) });
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
      header: "Wallet pass",
      cell: (level) => {
        const design = parsePassDesign(level.passDesign);
        if (Object.keys(design).length === 0) {
          return (
            <span className="text-muted-foreground text-sm">Event design</span>
          );
        }
        // The band alone, over the event's own design wherever this level
        // leaves a field unset — so house style stands in for "the event".
        return (
          <span
            aria-label="Custom design"
            role="img"
            className="block h-6 w-24 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{
              __html: stripSvg(
                {
                  ...resolvePassDesign([design]),
                  // A photo is not drawn into a thumbnail; its shade over the
                  // ground stands in for it.
                  ...(design.stripStyle === "PHOTO"
                    ? { stripStyle: "SOLID" as const }
                    : {}),
                },
                192,
                48,
                level.rank / maxRank,
              ),
            }}
          />
        );
      },
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
          <Button variant="outline" size="sm" asChild>
            <Link
              href={`/admin/access-levels/${encodeURIComponent(level.code)}`}
            >
              Edit
            </Link>
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
          <Button asChild>
            <Link href="/admin/access-levels/new">
              <Plus className="size-4" aria-hidden />
              Add level
            </Link>
          </Button>
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
