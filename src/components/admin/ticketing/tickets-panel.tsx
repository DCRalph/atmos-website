"use client";

import { useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Search,
  Trash2,
  Undo2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Textarea } from "~/components/ui/textarea";
import {
  DataTable,
  useDataTable,
  type DataTableColumn,
} from "~/components/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useConfirm } from "~/components/confirm-provider";
import { useDebouncedValue } from "~/hooks/use-debounced-value";
import { FilterSelect, ListFilters } from "../list-filters";
import { formatNZD } from "~/lib/ticketing/money";
import {
  ACCESS_LEVELS,
  type AccessLevelValue,
  accessLevel as accessLevelMeta,
} from "~/lib/ticketing/access-levels";
import {
  DEFAULT_EVENT_TIMEZONE,
  formatEventDateTime,
} from "~/lib/ticketing/dates";

type TicketRow = RouterOutputs["ticketAdmin"]["tickets"]["tickets"][number];

const PAID_METHODS = new Set(["STRIPE", "CASH", "TERMINAL", "TAP_TO_PAY"]);

const statusLabel = (status: string) => status.replace("_", " ").toLowerCase();

/** Matches the server's own limit on one delete call. */
const MAX_DELETE_AT_ONCE = 200;

function canRefund(ticket: TicketRow) {
  return (
    ticket.status === "VALID" &&
    !ticket.isComp &&
    PAID_METHODS.has(ticket.order.paymentMethod)
  );
}

function AccessLevelSelect({
  ticketId,
  value,
}: {
  ticketId: string;
  value: string;
}) {
  const utils = api.useUtils();
  const setLevel = api.ticketAdmin.setTicketAccessLevel.useMutation({
    onSuccess: () => {
      toast.success("Ticket updated");
      void utils.ticketAdmin.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <select
      value={value}
      disabled={setLevel.isPending}
      onChange={(e) =>
        setLevel.mutate({
          ticketId,
          accessLevel: e.target.value as AccessLevelValue,
        })
      }
      aria-label="Access level"
      className="border-input bg-background h-7 rounded-md border px-1.5 text-xs"
    >
      {ACCESS_LEVELS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/**
 * What a delete is about to take with it.
 *
 * Comp grants leave together — the hand-outs are only tickets because somebody
 * was given them to give away — so the count has to be said out loud before
 * anyone confirms two tickets and loses five.
 */
function describeDelete(tickets: TicketRow[]): string {
  const handouts = tickets.reduce(
    (sum, ticket) => sum + (ticket.hostTicketId ? 0 : ticket._count.handouts),
    0,
  );
  const paid = tickets.filter(
    (ticket) => ticket.pricePaidCents > 0 && ticket.status === "VALID",
  ).length;

  const head =
    tickets.length === 1
      ? "This ticket, its scan history and its wallet pass registration go for good."
      : `These ${tickets.length} tickets, their scan history and their wallet pass registrations go for good.`;

  return [
    head,
    handouts > 0
      ? `${handouts} hand-out${handouts === 1 ? "" : "s"} from the same comp grant ${handouts === 1 ? "goes" : "go"} too.`
      : null,
    "Any seat comes back on sale.",
    paid > 0
      ? `${paid === 1 ? "This one was" : `${paid} of them were`} paid for — nothing is refunded here, so refund first if the buyer is owed money.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");
}

type TicketFilters = {
  status: "VALID" | "VOID" | "REFUNDED" | null;
  kind: "SOLD" | "COMP" | "LINK" | null;
  named: "NAMED" | "UNNAMED" | null;
  door: "ARRIVED" | "NOT_ARRIVED" | null;
  accessLevel: AccessLevelValue | null;
};

const NO_TICKET_FILTERS: TicketFilters = {
  status: null,
  kind: null,
  named: null,
  door: null,
  accessLevel: null,
};

export function TicketsPanel({ eventId }: { eventId: string }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<TicketRow | null>(null);
  const [deleting, setDeleting] = useState<TicketRow[] | null>(null);
  const [filters, setFilters] = useState<TicketFilters>(NO_TICKET_FILTERS);
  const debouncedSearch = useDebouncedValue(search);

  const activeFilters = Object.values(filters).filter(Boolean).length;
  const set = <K extends keyof TicketFilters>(
    key: K,
    value: TicketFilters[K],
  ) => setFilters((current) => ({ ...current, [key]: value }));

  // Filtering happens in the query, not over the rows already loaded: this list
  // is paged, and filtering a page would answer "none of the fifty I have"
  // while the answer sat on page four.
  const tickets = api.ticketAdmin.tickets.useInfiniteQuery(
    {
      eventId,
      search: debouncedSearch.trim() || undefined,
      status: filters.status ?? undefined,
      kind: filters.kind ?? undefined,
      named: filters.named ?? undefined,
      door: filters.door ?? undefined,
      accessLevel: filters.accessLevel ?? undefined,
      limit: 50,
    },
    {
      getNextPageParam: (page) => page.nextCursor ?? undefined,
    },
  );

  const rows = tickets.data?.pages.flatMap((page) => page.tickets) ?? [];
  const openTicket = selected
    ? (rows.find((ticket) => ticket.id === selected.id) ?? selected)
    : null;

  const columns: DataTableColumn<TicketRow>[] = [
    {
      id: "ticketNumber",
      header: "Ticket",
      accessor: (row) => row.ticketNumber,
      cell: (row) => (
        <span className="font-mono font-medium">{row.ticketNumber}</span>
      ),
    },
    {
      id: "attendee",
      header: "Attendee",
      accessor: (row) => row.attendeeName ?? "",
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate">{row.attendeeName ?? "No name"}</p>
          {row.attendeeEmail && (
            <p className="text-muted-foreground truncate text-xs">
              {row.attendeeEmail}
            </p>
          )}
        </div>
      ),
    },
    {
      id: "type",
      header: "Type",
      accessor: (row) => row.typeName,
      cell: (row) => (
        <span>
          {row.typeName}
          {row.isComp ? (
            <span className="text-muted-foreground"> · comp</span>
          ) : null}
        </span>
      ),
    },
    {
      id: "order",
      header: "Order",
      accessor: (row) => row.order.buyerName ?? "",
      cell: (row) => (
        <div className="min-w-0">
          <p className="font-mono text-xs">{row.order.orderNumber}</p>
          <p className="text-muted-foreground truncate text-xs">
            {row.order.buyerName ?? "No name"}
          </p>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      type: "badge",
      accessor: (row) => statusLabel(row.status),
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          <Badge variant={row.status === "VALID" ? "outline" : "destructive"}>
            {statusLabel(row.status)}
          </Badge>
          {row.admittedAt && <Badge variant="secondary">inside</Badge>}
          {row.departedAt && <Badge variant="secondary">left</Badge>}
          {row.deniedAt && <Badge variant="destructive">refused</Badge>}
        </div>
      ),
    },
    {
      id: "accessLevel",
      header: "Access",
      accessor: (row) => row.accessLevel,
      cell: (row) => (
        <Badge variant="outline">
          {accessLevelMeta(row.accessLevel).short}
        </Badge>
      ),
    },
    {
      id: "price",
      header: "Paid",
      type: "number",
      align: "right",
      accessor: (row) => row.pricePaidCents,
      cell: (row) => (
        <span className="tabular-nums">{formatNZD(row.pricePaidCents)}</span>
      ),
    },
    {
      id: "createdAt",
      header: "Issued",
      type: "date",
      accessor: (row) => row.createdAt,
      cell: (row) => formatEventDateTime(row.createdAt, DEFAULT_EVENT_TIMEZONE),
    },
  ];

  // Held here rather than inside the table so a delete can drop the selection
  // it just acted on; otherwise the banner keeps counting rows that are gone.
  const table = useDataTable<TicketRow>({
    columns,
    getRowId: (row) => row.id,
    storageKey: "admin-event-tickets",
  });

  return (
    <div className="space-y-4">
      <ListFilters
        activeCount={activeFilters}
        onClear={() => setFilters(NO_TICKET_FILTERS)}
        summary={
          tickets.isPending
            ? null
            : `${rows.length}${tickets.hasNextPage ? "+" : ""} ticket${
                rows.length === 1 ? "" : "s"
              }`
        }
      >
        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(value) => set("status", value)}
          options={[
            { value: "VALID", label: "Valid" },
            { value: "VOID", label: "Void" },
            { value: "REFUNDED", label: "Refunded" },
          ]}
        />
        <FilterSelect
          label="Name"
          value={filters.named}
          onChange={(value) => set("named", value)}
          options={[
            { value: "NAMED", label: "Named" },
            { value: "UNNAMED", label: "No name yet" },
          ]}
        />
        <FilterSelect
          label="Door"
          value={filters.door}
          onChange={(value) => set("door", value)}
          options={[
            { value: "ARRIVED", label: "Arrived" },
            { value: "NOT_ARRIVED", label: "Not arrived" },
          ]}
        />
        <FilterSelect
          label="Kind"
          value={filters.kind}
          onChange={(value) => set("kind", value)}
          options={[
            { value: "SOLD", label: "Sold" },
            { value: "COMP", label: "Comp" },
            { value: "LINK", label: "Ticket link" },
          ]}
        />
        <FilterSelect
          label="Access"
          value={filters.accessLevel}
          onChange={(value) => set("accessLevel", value)}
          options={ACCESS_LEVELS.map((level) => ({
            value: level.value,
            label: level.label,
          }))}
        />
      </ListFilters>

      <DataTable
        api={table}
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        isLoading={tickets.isPending}
        isFetching={tickets.isFetching && !tickets.isFetchingNextPage}
        onRowClick={(row) => setSelected(row)}
        storageKey="admin-event-tickets"
        emptyMessage="No tickets yet."
        bulkActions={[
          {
            label: "Delete",
            variant: "destructive",
            onClick: (selectedRows) => setDeleting(selectedRows),
          },
        ]}
        toolbarActions={
          <div className="relative w-full max-w-xs">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ticket, name, email or order"
              className="pl-9"
            />
          </div>
        }
      />

      {tickets.hasNextPage && (
        <Button
          variant="outline"
          disabled={tickets.isFetchingNextPage}
          onClick={() => void tickets.fetchNextPage()}
        >
          {tickets.isFetchingNextPage ? "Loading…" : "Load more"}
        </Button>
      )}

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-mono">
              {openTicket?.ticketNumber ?? "Ticket"}
            </DialogTitle>
            <DialogDescription>
              {openTicket?.attendeeName ?? "No name"} · {openTicket?.typeName}
            </DialogDescription>
          </DialogHeader>
          {openTicket && (
            <TicketDetail
              key={openTicket.id}
              ticket={openTicket}
              onDelete={() => {
                setDeleting([openTicket]);
                setSelected(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <DeleteTicketsDialog
        tickets={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => {
          setDeleting(null);
          table.clearSelection();
        }}
      />
    </div>
  );
}

/** Reason, consequences, confirm — the same flow for one ticket or fifty. */
function DeleteTicketsDialog({
  tickets,
  onClose,
  onDeleted,
}: {
  tickets: TicketRow[] | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const utils = api.useUtils();
  const [reason, setReason] = useState("");

  const remove = api.ticketAdmin.deleteTickets.useMutation({
    onSuccess: (result) => {
      toast.success(
        `${result.deleted} ticket${result.deleted === 1 ? "" : "s"} deleted.${
          result.withGrant > 0
            ? ` ${result.withGrant} came from the same comp grant.`
            : ""
        }`,
      );
      setReason("");
      void utils.ticketAdmin.invalidate();
      void utils.ticketEvents.byId.invalidate();
      void utils.ticketAnalytics.invalidate();
      onDeleted();
    },
    onError: (error) => toast.error(error.message),
  });

  const count = tickets?.length ?? 0;
  const tooMany = count > MAX_DELETE_AT_ONCE;

  return (
    <Dialog
      open={tickets !== null}
      onOpenChange={(open) => {
        if (!open && !remove.isPending) {
          setReason("");
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Delete {count === 1 ? "this ticket" : `${count} tickets`}?
          </DialogTitle>
          <DialogDescription>
            {tooMany
              ? `${count} is more than one delete can take. Select up to ${MAX_DELETE_AT_ONCE} at a time.`
              : tickets
                ? describeDelete(tickets)
                : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="delete-reason">Reason</Label>
          <Textarea
            id="delete-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
            placeholder="Kept in the activity log — it's all that's left afterwards"
            className="min-h-16"
          />
        </div>

        {tickets && tickets.length <= 8 && (
          <ul className="text-muted-foreground max-h-32 space-y-0.5 overflow-y-auto text-xs">
            {tickets.map((ticket) => (
              <li key={ticket.id} className="break-words">
                <span className="font-mono">{ticket.ticketNumber}</span> ·{" "}
                {ticket.attendeeName ?? "No name"} · {ticket.typeName}
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            disabled={remove.isPending}
            onClick={() => {
              setReason("");
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={
              remove.isPending ||
              reason.trim().length === 0 ||
              !tickets ||
              tooMany
            }
            onClick={() => {
              if (!tickets) return;
              remove.mutate({
                ticketIds: tickets.map((ticket) => ticket.id),
                reason: reason.trim(),
              });
            }}
          >
            <Trash2 className="size-4" />
            {remove.isPending ? "Deleting…" : "Delete for good"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TicketDetail({
  ticket,
  onDelete,
}: {
  ticket: TicketRow;
  onDelete: () => void;
}) {
  const utils = api.useUtils();
  const confirm = useConfirm();
  const [name, setName] = useState(ticket.attendeeName ?? "");
  const [voidReason, setVoidReason] = useState("");

  const refresh = () => {
    void utils.ticketAdmin.invalidate();
    void utils.ticketEvents.byId.invalidate();
    void utils.ticketAnalytics.invalidate();
  };

  const setTicketName = api.ticketAdmin.setTicketName.useMutation({
    onSuccess: () => {
      toast.success("Name updated");
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const voidTicket = api.ticketAdmin.voidTicket.useMutation({
    onSuccess: () => {
      toast.success("Ticket voided.");
      setVoidReason("");
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const refund = api.ticketAdmin.refundTickets.useMutation({
    onSuccess: () => {
      toast.success("Refunded — ticket voided and the buyer notified.");
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const isValid = ticket.status === "VALID";
  const nameDirty = name.trim() !== (ticket.attendeeName ?? "");

  return (
    <div className="space-y-5">
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <Row label="Order" value={ticket.order.orderNumber} mono />
        <Row
          label="Buyer"
          value={`${ticket.order.buyerName ?? "No name"} · ${ticket.order.buyerEmail ?? "no email"}`}
        />
        <Row label="Type" value={ticket.typeName} />
        <Row label="Paid" value={formatNZD(ticket.pricePaidCents)} />
        <Row
          label="Issued"
          value={formatEventDateTime(ticket.createdAt, DEFAULT_EVENT_TIMEZONE)}
        />
        <Row
          label="Payment"
          value={ticket.order.paymentMethod.toLowerCase().replace("_", " ")}
        />
      </dl>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={isValid ? "outline" : "destructive"}>
          {statusLabel(ticket.status)}
        </Badge>
        {ticket.isComp && <Badge variant="secondary">comp</Badge>}
        {ticket.admittedAt && <Badge variant="secondary">inside</Badge>}
        {ticket.departedAt && <Badge variant="secondary">left</Badge>}
        {ticket.deniedAt && <Badge variant="destructive">refused</Badge>}
      </div>

      {ticket.status !== "VALID" && (ticket.voidedAt ?? ticket.voidReason) && (
        <p className="text-muted-foreground text-xs">
          {ticket.voidedAt
            ? formatEventDateTime(ticket.voidedAt, DEFAULT_EVENT_TIMEZONE)
            : null}
          {ticket.voidReason ? ` · ${ticket.voidReason}` : ""}
        </p>
      )}

      <TicketLink ticket={ticket} />

      <div className="space-y-2">
        <Label htmlFor={`ticket-name-${ticket.id}`}>Attendee name</Label>
        <div className="flex gap-2">
          <Input
            id={`ticket-name-${ticket.id}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder="Name on the ticket"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!nameDirty || setTicketName.isPending}
            onClick={() =>
              setTicketName.mutate({
                ticketId: ticket.id,
                attendeeName: name.trim(),
              })
            }
          >
            Save
          </Button>
        </div>
        {ticket.nameLockedAt && (
          <p className="text-muted-foreground text-xs">
            The buyer can no longer change this name. Saving here overrides
            that.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Label>Access level</Label>
        <AccessLevelSelect ticketId={ticket.id} value={ticket.accessLevel} />
      </div>

      {ticket.scans.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">Recent scans</p>
          <ul className="space-y-1">
            {ticket.scans.map((scan) => (
              <li
                key={scan.id}
                className="text-muted-foreground text-xs break-words"
              >
                {formatEventDateTime(scan.createdAt, DEFAULT_EVENT_TIMEZONE)} ·{" "}
                {scan.result.toLowerCase().replace("_", " ")}
                {scan.deviceLabel ? ` · ${scan.deviceLabel}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isValid && (
        <div className="space-y-3 border-t pt-4">
          <div className="space-y-2">
            <Label htmlFor={`void-reason-${ticket.id}`}>Void reason</Label>
            <Textarea
              id={`void-reason-${ticket.id}`}
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              maxLength={200}
              placeholder="Required to void without a refund"
              className="min-h-16"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              disabled={voidTicket.isPending || refund.isPending}
              onClick={async () => {
                const reason = voidReason.trim();
                if (!reason) {
                  toast.error("Give a reason before voiding.");
                  return;
                }
                const ok = await confirm({
                  title: "Void this ticket?",
                  description:
                    "The QR and wallet pass stop working immediately and the seat goes back on sale. No money is refunded.",
                  confirmLabel: "Void ticket",
                  variant: "destructive",
                });
                if (ok) voidTicket.mutate({ ticketId: ticket.id, reason });
              }}
            >
              <XCircle className="size-4" /> Void
            </Button>
            <Button
              variant="destructive"
              disabled={
                !canRefund(ticket) || refund.isPending || voidTicket.isPending
              }
              onClick={async () => {
                const ok = await confirm({
                  title: "Refund this ticket?",
                  description:
                    "Refunds through Stripe, voids the QR and wallet pass immediately, puts the seat back on sale, and emails the buyer.",
                  confirmLabel: "Refund",
                  variant: "destructive",
                });
                if (ok) {
                  refund.mutate({
                    orderId: ticket.orderId,
                    ticketIds: [ticket.id],
                  });
                }
              }}
            >
              <Undo2 className="size-4" /> Refund
            </Button>
          </div>
        </div>
      )}

      {/* Always available, including on a ticket that is already void: this is
          how a row that shouldn't exist leaves the door list for good. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="text-muted-foreground text-xs">
          Voiding keeps the ticket and its history. Deleting takes both.
        </p>
        <Button
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="size-4" /> Delete
        </Button>
      </div>
    </div>
  );
}

/**
 * The one ticket's own link, to hand back to whoever lost it.
 *
 * Deliberately this rather than the order link: it opens exactly this QR, so
 * sending it to one guest of four can't hand them everybody else's ticket. The
 * key on the end is a bearer credential — whoever holds the link holds the
 * ticket — which is why the warning sits under it rather than in a tooltip.
 */
function TicketLink({ ticket }: { ticket: TicketRow }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(ticket.ticketUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select the link and copy it manually.");
    }
  }

  return (
    <div className="space-y-2">
      <Label>Ticket link</Label>
      <div className="flex flex-wrap items-center gap-2">
        <code className="bg-muted min-w-0 flex-1 truncate rounded-md px-2.5 py-1.5 font-mono text-xs">
          {ticket.ticketUrl}
        </code>
        <Button size="sm" variant="outline" onClick={() => void copy()}>
          {copied ? (
            <>
              <Check className="size-3.5" /> Copied
            </>
          ) : (
            <>
              <Copy className="size-3.5" /> Copy
            </>
          )}
        </Button>
        <Button size="icon-sm" variant="ghost" asChild>
          <a href={ticket.ticketUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="size-3.5" />
            <span className="sr-only">Open ticket</span>
          </a>
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        {ticket.status === "VOID"
          ? "This ticket is void, so the link no longer opens."
          : "Anyone with this link can show the QR at the door — send it to the ticket holder only."}
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      {/* Wraps rather than truncates: a dialog is where you go to read the
          whole thing, and half an email address is no use to anybody. */}
      <dd className={mono ? "font-mono text-xs break-all" : "break-words"}>
        {value}
      </dd>
    </div>
  );
}
