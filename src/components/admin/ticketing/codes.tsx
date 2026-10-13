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
 * codes page, and an event's own on its Codes page. `types` is what the form
 * offers; given `tiers`, it is an event code and can be scoped to tiers or
 * unlock hidden ones. Given `initial`, it edits that code instead of creating
 * one.
 */

export type CodeType = "PERCENT" | "FIXED" | "UNLOCK";

/** A global code is only ever a discount. */
export const DISCOUNT_CODE_TYPES = ["PERCENT", "FIXED"] as const;
export const EVENT_CODE_TYPES = ["PERCENT", "FIXED", "UNLOCK"] as const;

const TYPE_LABELS: Record<CodeType, string> = {
  PERCENT: "Percentage off",
  FIXED: "Fixed amount off",
  UNLOCK: "Unlock hidden tiers",
};

export type CodeFormValues<T extends CodeType = CodeType> = {
  code: string;
  type: T;
  /** Basis points or cents. Always 0 on an unlock code. */
  value: number;
  maxRedemptions: number | null;
  maxPerEmail: number | null;
  minTickets: number | null;
  endsAt: Date | null;
  /** The tiers a discount applies to (empty is all), or the ones it unlocks. */
  tierIds: string[];
};

export type TierOption = { id: string; name: string; isHidden: boolean };

const toInt = (value: string) => (value ? Number.parseInt(value, 10) : null);
const toField = (value: number | null) => (value === null ? "" : String(value));

export function CodeForm<T extends CodeType>({
  types,
  tiers,
  initial,
  pending,
  onSubmit,
  onCancel,
}: {
  /** The kinds on offer. The first is the default for a new code. */
  types: readonly [T, ...T[]];
  /** The event's tiers. Absent for a global code, which covers every event. */
  tiers?: readonly TierOption[];
  /** The code being edited. Remount (via `key`) to load a different one. */
  initial?: CodeFormValues<T>;
  pending: boolean;
  onSubmit: (values: CodeFormValues<T>) => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState(initial?.code ?? "");
  const [type, setType] = useState<T>(initial?.type ?? types[0]);
  // Both kinds are stored in hundredths: basis points, or cents.
  const [value, setValue] = useState(
    initial && initial.type !== "UNLOCK" ? String(initial.value / 100) : "10",
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
  const [tierIds, setTierIds] = useState<string[]>(initial?.tierIds ?? []);

  const unlock = type === "UNLOCK";
  // An unlock code can only open hidden tiers; a discount can cover any.
  const tierOptions = unlock
    ? (tiers ?? []).filter((tier) => tier.isHidden)
    : (tiers ?? []);
  // Ticks left over from the other type don't count.
  const chosenTierIds = tierIds.filter((id) =>
    tierOptions.some((tier) => tier.id === id),
  );

  const valueCents = unlock
    ? 0
    : type === "PERCENT"
      ? /^\d+(\.\d+)?$/.test(value.trim())
        ? Math.round(Number.parseFloat(value) * 100)
        : null
      : parsePriceToCents(value);
  const valueValid = valueCents !== null && (unlock || valueCents > 0);
  const ready =
    code !== "" && valueValid && (!unlock || chosenTierIds.length > 0);

  return (
    <div className="grid gap-4 rounded-lg border p-5 md:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="code">Code</Label>
        <Input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={unlock ? "PRESALE" : "EARLYBIRD"}
          className="font-mono"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Type</Label>
        <Select
          value={type}
          onValueChange={(next) => {
            const picked = types.find((t) => t === next);
            if (picked) setType(picked);
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {types.map((t) => (
              <SelectItem key={t} value={t}>
                {TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!unlock && (
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
              {type === "PERCENT"
                ? "A percentage above zero, like 10 or 12.5."
                : "An amount above zero, like 5 or 7.50."}
            </p>
          )}
        </div>
      )}

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
        {unlock && (
          <p className="text-muted-foreground text-xs">
            Counted in orders. The tier&apos;s allocation caps tickets.
          </p>
        )}
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

      {tiers && (
        <div className="space-y-2 md:col-span-2">
          <Label>{unlock ? "Unlocks" : "Applies to"}</Label>
          {tierOptions.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {unlock
                ? 'This event has no hidden tiers yet. Mark one "Hidden until unlocked by a code" under Tiers and save.'
                : "This event has no tiers yet."}
            </p>
          ) : (
            <>
              <p className="text-muted-foreground text-xs">
                {unlock
                  ? "Whoever enters this code sees the ticked tiers alongside the public ones, at each tier's own price."
                  : "Leave all unticked to take it off every tier."}
              </p>
              {tierOptions.map((tier) => (
                <label
                  key={tier.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={chosenTierIds.includes(tier.id)}
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
            </>
          )}
        </div>
      )}

      <div className="flex gap-2 md:col-span-2">
        <Button
          disabled={pending || !ready}
          onClick={() =>
            onSubmit({
              code,
              type,
              value: valueCents ?? 0,
              maxRedemptions: toInt(maxRedemptions),
              maxPerEmail: toInt(maxPerEmail),
              minTickets: toInt(minTickets),
              endsAt: endsAt ?? null,
              tierIds: chosenTierIds,
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
  type: CodeType;
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
        row.type === "UNLOCK"
          ? "Unlock"
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
