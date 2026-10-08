"use client";

import { useState } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { DateTimePicker } from "~/components/ui/datetime-picker";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { useConfirm } from "~/components/confirm-provider";
import { formatDate } from "~/lib/date-utils";
import { formatNZD, parsePriceToCents } from "~/lib/ticketing/money";

/**
 * The form and table shared by both kinds of code: global ones on the Discount
 * codes page, and an event's own on its Codes page. Given `hiddenTiers`, the
 * form is for an event code and offers to unlock them. Given `initial`, it
 * edits that code instead of creating one.
 */

export type CodeFormValues = {
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
  maxRedemptions: number | null;
  maxPerEmail: number | null;
  minTickets: number | null;
  endsAt: Date | null;
  unlocksHiddenTiers: boolean;
  tierIds: string[];
};

const toInt = (value: string) => (value ? Number.parseInt(value, 10) : null);
const toField = (value: number | null) => (value === null ? "" : String(value));

export function CodeForm({
  hiddenTiers,
  initial,
  pending,
  onSubmit,
  onCancel,
}: {
  /** An event's hidden tiers. Absent for a global code, which can't unlock. */
  hiddenTiers?: { id: string; name: string }[];
  /** The code being edited. Remount (via `key`) to load a different one. */
  initial?: CodeFormValues;
  pending: boolean;
  onSubmit: (values: CodeFormValues) => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState(initial?.code ?? "");
  const [type, setType] = useState<"PERCENT" | "FIXED">(
    initial?.type ?? "PERCENT",
  );
  // Both kinds are stored in hundredths: basis points, or cents.
  const [value, setValue] = useState(
    initial ? String(initial.value / 100) : "10",
  );
  const [maxRedemptions, setMaxRedemptions] = useState(
    toField(initial?.maxRedemptions ?? null),
  );
  const [maxPerEmail, setMaxPerEmail] = useState(
    initial ? toField(initial.maxPerEmail) : "1",
  );
  const [minTickets, setMinTickets] = useState(
    toField(initial?.minTickets ?? null),
  );
  const [endsAt, setEndsAt] = useState<Date | undefined>(
    initial?.endsAt ?? undefined,
  );
  const [unlocks, setUnlocks] = useState(initial?.unlocksHiddenTiers ?? false);
  // Empty means every hidden tier on the event.
  const [tierIds, setTierIds] = useState<string[]>(initial?.tierIds ?? []);

  const valueCents =
    type === "PERCENT"
      ? /^\d+(\.\d+)?$/.test(value.trim())
        ? Math.round(Number.parseFloat(value) * 100)
        : null
      : parsePriceToCents(value);
  // An unlock code may be worth nothing: the tiers it opens are the point.
  const valueValid =
    valueCents !== null && (valueCents > 0 || (unlocks && valueCents === 0));

  return (
    <div className="grid gap-4 rounded-lg border p-5 md:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="code">Code</Label>
        <Input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={hiddenTiers ? "PRESALE" : "EARLYBIRD"}
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
          className={valueValid || value === "" ? "" : "border-destructive"}
        />
        {value !== "" && !valueValid && (
          <p className="text-destructive text-xs">
            {unlocks
              ? "Zero or more. Use 0 for a code that only unlocks tiers."
              : type === "PERCENT"
                ? "A percentage above zero, like 10 or 12.5."
                : "An amount above zero, like 5 or 7.50."}
          </p>
        )}
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

      {hiddenTiers && (
        <div className="space-y-3 md:col-span-2">
          <div className="flex items-center gap-2">
            <Switch checked={unlocks} onCheckedChange={setUnlocks} />
            <span className="text-sm">
              Unlocks hidden tiers — turns this into a presale or guest list key
            </span>
          </div>
          {unlocks &&
            (hiddenTiers.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                This event has no hidden tiers yet. Mark one &quot;Hidden until
                unlocked by a code&quot; under Tiers.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-muted-foreground text-xs">
                  Tick the tiers this code opens. Leave all unticked to open
                  every hidden tier. The discount applies to the ticked tiers
                  only.
                </p>
                {hiddenTiers.map((tier) => (
                  <label
                    key={tier.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={tierIds.includes(tier.id)}
                      onCheckedChange={(checked) =>
                        setTierIds((current) =>
                          checked === true
                            ? [...current, tier.id]
                            : current.filter((id) => id !== tier.id),
                        )
                      }
                    />
                    {tier.name}
                  </label>
                ))}
              </div>
            ))}
        </div>
      )}

      <div className="flex gap-2 md:col-span-2">
        <Button
          disabled={pending || !code || !valueValid}
          onClick={() =>
            onSubmit({
              code,
              type,
              value: valueCents ?? 0,
              maxRedemptions: toInt(maxRedemptions),
              maxPerEmail: toInt(maxPerEmail),
              minTickets: toInt(minTickets),
              endsAt: endsAt ?? null,
              unlocksHiddenTiers: unlocks,
              tierIds: unlocks ? tierIds : [],
            })
          }
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden /> Saving…
            </>
          ) : initial ? (
            "Save changes"
          ) : (
            "Create code"
          )}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** What a row needs, from either table. */
type CodeRow = {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
  redemptionCount: number;
  maxRedemptions: number | null;
  endsAt: Date | null;
  isActive: boolean;
};

export function CodesTable<TRow extends CodeRow>({
  rows,
  isLoading,
  isFetching,
  storageKey,
  extraColumns = [],
  onSetActive,
  onEdit,
  onDelete,
  deleting,
}: {
  rows: TRow[];
  isLoading: boolean;
  isFetching: boolean;
  storageKey: string;
  /** Inserted after the discount column. */
  extraColumns?: DataTableColumn<TRow>[];
  onSetActive: (id: string, isActive: boolean) => void;
  onEdit: (row: TRow) => void;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  const confirm = useConfirm();

  const columns: DataTableColumn<TRow>[] = [
    {
      id: "code",
      header: "Code",
      sortable: true,
      accessor: (row) => row.code,
      cell: (row) => <span className="font-mono font-medium">{row.code}</span>,
    },
    {
      id: "discount",
      header: "Discount",
      cell: (row) =>
        row.value === 0
          ? "—"
          : row.type === "PERCENT"
            ? `${row.value / 100}% off`
            : `${formatNZD(row.value)} off`,
    },
    ...extraColumns,
    {
      id: "used",
      header: "Used",
      type: "number",
      align: "right",
      sortable: true,
      accessor: (row) => row.redemptionCount,
      cell: (row) => (
        <div className="flex items-center justify-end gap-2">
          <span className="tabular-nums">
            {row.redemptionCount}
            {row.maxRedemptions !== null ? ` of ${row.maxRedemptions}` : ""}
          </span>
          {row.maxRedemptions !== null &&
            row.redemptionCount >= row.maxRedemptions && (
              <Badge variant="destructive">used up</Badge>
            )}
        </div>
      ),
    },
    {
      id: "endsAt",
      header: "Expires",
      type: "date",
      sortable: true,
      accessor: (row) => row.endsAt,
      cell: (row) => (row.endsAt ? formatDate(row.endsAt, "short") : "—"),
    },
    {
      id: "isActive",
      header: "Active",
      sortable: true,
      accessor: (row) => row.isActive,
      cell: (row) => (
        <Switch
          checked={row.isActive}
          aria-label={`${row.isActive ? "Deactivate" : "Activate"} ${row.code}`}
          onCheckedChange={(value) => onSetActive(row.id, value)}
        />
      ),
    },
    {
      id: "actions",
      header: "",
      hideable: false,
      align: "right",
      cell: (row) => (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Edit ${row.code}`}
            onClick={() => onEdit(row)}
          >
            <Pencil className="size-4" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete ${row.code}`}
            disabled={deleting}
            onClick={async () => {
              const ok = await confirm({
                title: `Delete ${row.code}?`,
                description:
                  "Only possible before it has been used. Otherwise deactivate it so the sales history stays intact.",
                confirmLabel: "Delete",
                variant: "destructive",
              });
              if (ok) onDelete(row.id);
            }}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(row) => row.id}
      isLoading={isLoading}
      isFetching={isFetching}
      storageKey={storageKey}
      emptyMessage="No codes yet."
    />
  );
}
