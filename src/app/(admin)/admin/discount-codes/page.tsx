"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { AdminSection } from "~/components/admin/admin-section";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Switch } from "~/components/ui/switch";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { DateTimePicker } from "~/components/ui/datetime-picker";
import { PickerSelect } from "~/components/ui/picker-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useConfirm } from "~/components/confirm-provider";
import { formatNZD, parsePriceToCents } from "~/lib/ticketing/money";

type CodeListItem = RouterOutputs["discountCodes"]["list"][number];

const isExhausted = (code: CodeListItem) =>
  code.maxRedemptions !== null && code.redemptionCount >= code.maxRedemptions;

/**
 * Discount codes.
 *
 * A code can be a straight percentage off, a fixed amount, or the key that
 * unlocks a hidden tier — which is how a presale or a guest list works without
 * a separate mechanism.
 */
export default function DiscountCodesPage() {
  const [creating, setCreating] = useState(false);
  const utils = api.useUtils();
  const confirm = useConfirm();
  const codes = api.discountCodes.list.useQuery({});

  const update = api.discountCodes.update.useMutation({
    onSuccess: () => void utils.discountCodes.list.invalidate(),
    onError: (error) => toast.error(error.message),
  });

  const remove = api.discountCodes.delete.useMutation({
    onSuccess: () => {
      toast.success("Deleted");
      void utils.discountCodes.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const columns: DataTableColumn<CodeListItem>[] = [
    {
      id: "code",
      header: "Code",
      accessor: (row) => row.code,
      cell: (row) => <span className="font-mono font-medium">{row.code}</span>,
    },
    {
      id: "discount",
      header: "Discount",
      cell: (row) =>
        row.type === "PERCENT"
          ? `${row.value / 100}% off`
          : `${formatNZD(row.value)} off`,
    },
    {
      id: "event",
      header: "Event",
      cell: (row) =>
        row.event ? (
          <Badge variant="outline">{row.event.name}</Badge>
        ) : (
          <span className="text-muted-foreground">Any event</span>
        ),
    },
    {
      id: "unlocksHiddenTiers",
      header: "Unlocks hidden",
      type: "boolean",
      accessor: (row) => row.unlocksHiddenTiers,
    },
    {
      id: "used",
      header: "Used",
      type: "number",
      align: "right",
      accessor: (row) => row.redemptionCount,
      cell: (row) => (
        <div className="flex items-center justify-end gap-2">
          <span className="tabular-nums">
            {row.redemptionCount}
            {row.maxRedemptions !== null ? ` of ${row.maxRedemptions}` : ""}
          </span>
          {isExhausted(row) && <Badge variant="destructive">used up</Badge>}
        </div>
      ),
    },
    {
      id: "endsAt",
      header: "Expires",
      type: "date",
      accessor: (row) => row.endsAt,
      cell: (row) =>
        row.endsAt ? row.endsAt.toLocaleDateString("en-NZ") : "—",
    },
    {
      id: "isActive",
      header: "Active",
      cell: (row) => (
        <Switch
          checked={row.isActive}
          aria-label={`${row.isActive ? "Deactivate" : "Activate"} ${row.code}`}
          onCheckedChange={(value) =>
            update.mutate({ id: row.id, isActive: value })
          }
        />
      ),
    },
    {
      id: "actions",
      header: "",
      hideable: false,
      align: "right",
      cell: (row) => (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete ${row.code}`}
          onClick={async () => {
            const ok = await confirm({
              title: `Delete ${row.code}?`,
              description:
                "Only possible before it has been used. Otherwise deactivate it so the sales history stays intact.",
              confirmLabel: "Delete",
              variant: "destructive",
            });
            if (ok) remove.mutate({ id: row.id });
          }}
        >
          <Trash2 className="size-4" />
        </Button>
      ),
    },
  ];

  return (
    <AdminSection
      title="Discount codes"
      description="Percentage or fixed-amount codes, optionally scoped to one event."
      actions={
        <Button onClick={() => setCreating(true)} disabled={creating}>
          <Plus className="size-4" /> New code
        </Button>
      }
    >
      {creating && <CodeForm onDone={() => setCreating(false)} />}

      <div className="mt-4">
        <DataTable
          columns={columns}
          data={codes.data ?? []}
          getRowId={(row) => row.id}
          isLoading={codes.isPending}
          isFetching={codes.isFetching}
          storageKey="admin-discount-codes"
          emptyMessage="No codes yet."
        />
      </div>
    </AdminSection>
  );
}

function CodeForm({ onDone }: { onDone: () => void }) {
  const utils = api.useUtils();

  const [code, setCode] = useState("");
  const [type, setType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [value, setValue] = useState("10");
  const [eventId, setEventId] = useState<string | null>(null);
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [maxPerEmail, setMaxPerEmail] = useState("1");
  const [minTickets, setMinTickets] = useState("");
  const [endsAt, setEndsAt] = useState<Date | undefined>();
  const [unlocksHidden, setUnlocksHidden] = useState(false);

  const create = api.discountCodes.create.useMutation({
    onSuccess: () => {
      toast.success("Code created");
      void utils.discountCodes.list.invalidate();
      onDone();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="grid gap-4 rounded-lg border p-5 md:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="code">Code</Label>
        <Input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="EARLYBIRD"
          className="font-mono"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Type</Label>
        <Select
          value={type}
          onValueChange={(next) => setType(next as "PERCENT" | "FIXED")}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PERCENT">Percentage off</SelectItem>
            <SelectItem value="FIXED">Fixed amount off</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="value">
          {type === "PERCENT" ? "Percent off" : "Amount off (NZD)"}
        </Label>
        <Input
          id="value"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="code-event">Event</Label>
        <PickerSelect
          id="code-event"
          endpoint={api.pickers.ticketEvents}
          value={eventId}
          onChange={setEventId}
          placeholder="Any event"
          searchPlaceholder="Search events…"
          emptyText="No events match that."
          clearLabel="Any event"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="maxred">Total uses</Label>
        <Input
          id="maxred"
          type="number"
          min={1}
          value={maxRedemptions}
          onChange={(e) => setMaxRedemptions(e.target.value)}
          placeholder="Unlimited"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="maxemail">Uses per email</Label>
        <Input
          id="maxemail"
          type="number"
          min={1}
          value={maxPerEmail}
          onChange={(e) => setMaxPerEmail(e.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          Best-effort on card checkouts — we only learn the email after payment.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="mintickets">Minimum tickets</Label>
        <Input
          id="mintickets"
          type="number"
          min={1}
          value={minTickets}
          onChange={(e) => setMinTickets(e.target.value)}
          placeholder="No minimum"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Expires</Label>
        <DateTimePicker date={endsAt} onDateChange={setEndsAt} />
      </div>

      <div className="flex items-center gap-2 md:col-span-2">
        <Switch checked={unlocksHidden} onCheckedChange={setUnlocksHidden} />
        <span className="text-sm">
          Unlocks hidden tiers — turns this into a presale or guest list key
        </span>
      </div>

      <div className="flex gap-2 md:col-span-2">
        <Button
          disabled={create.isPending || !code}
          onClick={() =>
            create.mutate({
              code,
              type,
              value:
                type === "PERCENT"
                  ? Math.round(Number.parseFloat(value) * 100)
                  : (parsePriceToCents(value) ?? 0),
              eventId,
              tierIds: [],
              maxRedemptions: maxRedemptions
                ? Number.parseInt(maxRedemptions, 10)
                : null,
              maxPerEmail: maxPerEmail
                ? Number.parseInt(maxPerEmail, 10)
                : null,
              minTickets: minTickets ? Number.parseInt(minTickets, 10) : null,
              endsAt: endsAt ?? null,
              isActive: true,
              unlocksHiddenTiers: unlocksHidden,
            })
          }
        >
          {create.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Creating…
            </>
          ) : (
            "Create code"
          )}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
