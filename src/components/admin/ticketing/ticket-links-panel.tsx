"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Link2,
  Loader2,
  Minus,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

type AdminEvent = RouterOutputs["ticketEvents"]["byId"];
type Batch = RouterOutputs["ticketAdmin"]["ticketLinkBatches"][number];
type BatchDetail = RouterOutputs["ticketAdmin"]["ticketLinkBatch"];

const MAX_PRIMARY_LINKS = 100;
const MAX_PLUS_PER_LINK = 10;

function remainingInTier(tier: {
  allocation: number;
  soldCount: number;
  heldCount: number;
}): number {
  return Math.max(0, tier.allocation - tier.soldCount - tier.heldCount);
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Unnamed ticket links drawn from a tier.
 *
 * These are not comps: they take allocation and capacity the same way a sale
 * does. Each primary link is immediately usable. Plus tickets sit on that
 * page as hand-outs, so whoever gets the link can copy or assign them.
 */
export function TicketLinksPanel({ event }: { event: AdminEvent }) {
  const utils = api.useUtils();

  const [tierId, setTierId] = useState(event.tiers[0]?.id ?? "");
  const [primaryCount, setPrimaryCount] = useState(10);
  const [plusCount, setPlusCount] = useState(0);
  const [label, setLabel] = useState("");
  const [openBatchId, setOpenBatchId] = useState<string | null>(null);

  const batches = api.ticketAdmin.ticketLinkBatches.useQuery({
    eventId: event.id,
  });
  const detail = api.ticketAdmin.ticketLinkBatch.useQuery(
    { batchId: openBatchId ?? "" },
    { enabled: openBatchId !== null },
  );

  const selectedTier = event.tiers.find((tier) => tier.id === tierId);
  const remaining = selectedTier ? remainingInTier(selectedTier) : 0;
  const ticketCount = primaryCount * (1 + plusCount);
  const canGenerate =
    Boolean(selectedTier) &&
    primaryCount >= 1 &&
    primaryCount <= MAX_PRIMARY_LINKS &&
    remaining >= ticketCount;

  const refresh = async () => {
    await Promise.all([
      utils.ticketAdmin.ticketLinkBatches.invalidate(),
      utils.ticketEvents.byId.invalidate(),
      utils.ticketAnalytics.overview.invalidate(),
    ]);
  };

  const create = api.ticketAdmin.createTicketLinkBatch.useMutation({
    onSuccess: async (batch) => {
      toast.success(
        batch.plusCount > 0
          ? `Generated ${batch.primaryCount} links, +${batch.plusCount} each.`
          : `Generated ${batch.primaryCount} link${batch.primaryCount === 1 ? "" : "s"}.`,
      );
      setLabel("");
      utils.ticketAdmin.ticketLinkBatch.setData({ batchId: batch.id }, batch);
      setOpenBatchId(batch.id);
      await refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const columns: DataTableColumn<Batch>[] = useMemo(
    () => [
      {
        id: "label",
        header: "Batch",
        accessor: (row) => row.label ?? "",
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.label ?? "Untitled"}</p>
            <p className="text-muted-foreground truncate text-xs">
              {row.tierName}
            </p>
          </div>
        ),
      },
      {
        id: "links",
        header: "Links",
        accessor: (row) => row.primaryCount,
        cell: (row) => (
          <span className="tabular-nums">
            {row.primaryCount}
            {row.plusCount > 0 ? ` +${row.plusCount}` : ""}
          </span>
        ),
      },
      {
        id: "tickets",
        header: "Tickets",
        accessor: (row) => row.ticketCount,
        cell: (row) => <span className="tabular-nums">{row.ticketCount}</span>,
      },
      {
        id: "createdAt",
        header: "Created",
        type: "date",
        accessor: (row) => row.createdAt,
        cell: (row) =>
          new Date(row.createdAt).toLocaleDateString("en-NZ", {
            day: "numeric",
            month: "short",
          }),
      },
    ],
    [],
  );

  return (
    <div className="space-y-8">
      <section className="space-y-4 rounded-lg border p-5">
        <div>
          <h2 className="text-xl font-semibold">Generate ticket links</h2>
          <p className="text-muted-foreground text-sm">
            Draws from a tier and gives you links to send. Each one is a real
            ticket, usable as soon as they open it. Add extras if they should be
            able to hand some out.
          </p>
        </div>

        {event.tiers.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            Add a tier first — these links come out of one.
          </p>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Tier</Label>
                <Select value={tierId} onValueChange={setTierId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a tier" />
                  </SelectTrigger>
                  <SelectContent>
                    {event.tiers.map((tier) => (
                      <SelectItem key={tier.id} value={tier.id}>
                        {tier.name} · {remainingInTier(tier)} left
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="link-batch-label">Label (optional)</Label>
                <Input
                  id="link-batch-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Press list, radio guests…"
                  maxLength={120}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="link-count">How many links</Label>
                <Input
                  id="link-count"
                  type="number"
                  min={1}
                  max={MAX_PRIMARY_LINKS}
                  value={primaryCount}
                  onChange={(e) => {
                    const next = Number.parseInt(e.target.value, 10);
                    if (Number.isNaN(next)) {
                      setPrimaryCount(1);
                      return;
                    }
                    setPrimaryCount(
                      Math.min(MAX_PRIMARY_LINKS, Math.max(1, next)),
                    );
                  }}
                />
                <p className="text-muted-foreground text-xs">
                  Up to {MAX_PRIMARY_LINKS}. Each is its own ticket page.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>+ tickets they can hand out</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    aria-label="One fewer extra ticket"
                    disabled={plusCount === 0}
                    onClick={() => setPlusCount((n) => Math.max(0, n - 1))}
                  >
                    <Minus className="size-4" />
                  </Button>
                  <span className="w-8 text-center tabular-nums">
                    {plusCount}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    aria-label="One more extra ticket"
                    disabled={plusCount >= MAX_PLUS_PER_LINK}
                    onClick={() =>
                      setPlusCount((n) => Math.min(MAX_PLUS_PER_LINK, n + 1))
                    }
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">
                  Same tier. They copy or assign them from their own link.
                </p>
              </div>
            </div>

            <p className="text-muted-foreground text-sm">
              {ticketCount} ticket{ticketCount === 1 ? "" : "s"} from{" "}
              {selectedTier?.name ?? "this tier"}
              {selectedTier ? ` · ${remaining} left` : ""}.
            </p>

            <Button
              disabled={!canGenerate || create.isPending}
              onClick={() =>
                create.mutate({
                  eventId: event.id,
                  tierId,
                  primaryCount,
                  plusCount,
                  label: label.trim() || undefined,
                })
              }
            >
              {create.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Generating…
                </>
              ) : (
                <>
                  <Link2 className="size-4" />
                  {plusCount > 0
                    ? `Generate ${primaryCount} links (+${plusCount} each)`
                    : `Generate ${primaryCount} link${primaryCount === 1 ? "" : "s"}`}
                </>
              )}
            </Button>
          </>
        )}
      </section>

      <section className="space-y-3">
        <DataTable
          title="Batches"
          columns={columns}
          data={batches.data ?? []}
          getRowId={(row) => row.id}
          isLoading={batches.isPending}
          isFetching={batches.isFetching}
          onRowClick={(row) => setOpenBatchId(row.id)}
          storageKey="admin-ticket-link-batches"
          emptyMessage="No link batches for this event yet."
        />
      </section>

      <Dialog
        open={openBatchId !== null}
        onOpenChange={(open) => !open && setOpenBatchId(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{detail.data?.label ?? "Ticket links"}</DialogTitle>
            <DialogDescription>
              {detail.data
                ? `${detail.data.primaryCount} link${
                    detail.data.primaryCount === 1 ? "" : "s"
                  } from ${detail.data.tierName}${
                    detail.data.plusCount > 0
                      ? ` · +${detail.data.plusCount} to hand out each`
                      : ""
                  }`
                : "Loading this batch."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {detail.isPending ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                Loading links…
              </p>
            ) : detail.data ? (
              <BatchLinks batch={detail.data} />
            ) : (
              <p className="text-muted-foreground py-8 text-center text-sm">
                Couldn&apos;t load that batch.
              </p>
            )}
          </DialogBody>
          {detail.data && (
            <DialogFooter>
              <BatchActions batch={detail.data} />
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BatchLinks({ batch }: { batch: BatchDetail }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copy = async (link: BatchDetail["links"][number]) => {
    await navigator.clipboard.writeText(link.ticketUrl);
    setCopiedId(link.ticketId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <ul className="space-y-2">
      {batch.links.map((link, index) => (
        <li
          key={link.ticketId}
          className="flex items-center gap-2 rounded-md border p-2"
        >
          <span className="text-muted-foreground w-8 shrink-0 text-right text-xs tabular-nums">
            {index + 1}
          </span>
          <code className="min-w-0 flex-1 truncate font-mono text-xs">
            {link.ticketNumber}
          </code>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void copy(link)}
          >
            {copiedId === link.ticketId ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
            {copiedId === link.ticketId ? "Copied" : "Copy"}
          </Button>
          <Button type="button" size="icon-sm" variant="ghost" asChild>
            <a href={link.ticketUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3.5" />
              <span className="sr-only">Open ticket</span>
            </a>
          </Button>
        </li>
      ))}
    </ul>
  );
}

function BatchActions({ batch }: { batch: BatchDetail }) {
  const [copied, setCopied] = useState(false);

  const copyAll = async () => {
    await navigator.clipboard.writeText(
      batch.links.map((link) => link.ticketUrl).join("\n"),
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied every link.");
  };

  const exportCsv = () => {
    const header = ["number", "ticketNumber", "url", "plusTickets"];
    const rows = batch.links.map((link, index) => [
      String(index + 1),
      link.ticketNumber,
      link.ticketUrl,
      String(batch.plusCount),
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map(csvEscape).join(","))
      .join("\n");
    const slug = (batch.label ?? batch.tierName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    downloadCsv(`ticket-links-${slug || "batch"}.csv`, csv);
  };

  return (
    <>
      <Button type="button" variant="outline" onClick={exportCsv}>
        <Download className="size-4" />
        CSV
      </Button>
      <Button type="button" onClick={() => void copyAll()}>
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? "Copied" : "Copy all"}
      </Button>
    </>
  );
}
