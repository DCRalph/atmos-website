"use client";

import { useState } from "react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Field } from "./workspace/fields";
import {
  doorTotalsSchema,
  sumDoorTotals,
  type DoorTotals,
} from "~/lib/ticketing/door-totals";
import { formatNZD, parsePriceToCents } from "~/lib/ticketing/money";
import { formatEventDateTime } from "~/lib/ticketing/dates";

type SavedTotals = RouterOutputs["ticketAnalytics"]["overview"]["doorTotals"];

function draftFrom(totals: SavedTotals) {
  return {
    cashTickets: String(totals?.cashTickets ?? 0),
    cashCents: ((totals?.cashCents ?? 0) / 100).toFixed(2),
    eftposTickets: String(totals?.eftposTickets ?? 0),
    eftposCents: ((totals?.eftposCents ?? 0) / 100).toFixed(2),
    notes: totals?.notes ?? "",
  };
}

/** Final totals replace the previous tally; they never add another batch. */
export function DoorTotalsPanel({
  eventId,
  totals,
  timezone,
}: {
  eventId: string;
  totals: SavedTotals;
  timezone: string;
}) {
  const [draft, setDraft] = useState(() => draftFrom(totals));
  const [errors, setErrors] = useState<
    Partial<Record<keyof DoorTotals, string[]>>
  >({});
  const utils = api.useUtils();
  const save = api.ticketAdmin.saveDoorTotals.useMutation({
    onSuccess: (saved) => {
      setDraft(draftFrom(saved));
      setErrors({});
      toast.success("Door totals saved.");
      void utils.ticketAnalytics.invalidate();
      void utils.analytics.invalidate();
      void utils.ticketEvents.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const parsed = doorTotalsSchema.safeParse({
    cashTickets: Number(draft.cashTickets),
    cashCents: draft.cashCents.trim()
      ? (parsePriceToCents(draft.cashCents) ?? NaN)
      : 0,
    eftposTickets: Number(draft.eftposTickets),
    eftposCents: draft.eftposCents.trim()
      ? (parsePriceToCents(draft.eftposCents) ?? NaN)
      : 0,
    notes: draft.notes,
  });
  const summary = parsed.success ? sumDoorTotals(parsed.data) : null;
  const dirty = JSON.stringify(draft) !== JSON.stringify(draftFrom(totals));
  const update = (field: keyof DoorTotals, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  return (
    <form
      className="rounded-lg border p-4"
      aria-labelledby="door-totals-title"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!parsed.success) {
          setErrors(parsed.error.flatten().fieldErrors);
          return;
        }
        save.mutate({ eventId, ...parsed.data });
      }}
    >
      <h3 id="door-totals-title" className="font-semibold">
        Off-platform door sales
      </h3>
      <p className="text-muted-foreground mt-1 text-sm">
        Record sales collected outside Atmos. Enter final totals for this event,
        excluding sales already recorded here.
      </p>
      <fieldset
        disabled={save.isPending}
        className="mt-4 space-y-4 disabled:opacity-60"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {(["cash", "eftpos"] as const).flatMap((method) => {
            const label = method === "cash" ? "Cash" : "EFTPOS";
            return (["Tickets", "Cents"] as const).map((unit) => {
              const field = `${method}${unit}` as const;
              const id = `door-totals-${field}`;
              const error = errors[field]?.[0];
              return (
                <Field
                  key={field}
                  id={id}
                  label={`${label} · ${unit === "Tickets" ? "tickets sold" : "total collected (NZD)"}`}
                >
                  <Input
                    id={id}
                    inputMode={unit === "Tickets" ? "numeric" : "decimal"}
                    value={draft[field]}
                    onChange={(event) => update(field, event.target.value)}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? `${id}-error` : undefined}
                    className="text-right tabular-nums"
                  />
                  {error ? (
                    <p
                      id={`${id}-error`}
                      role="alert"
                      className="text-destructive text-xs"
                    >
                      {error}
                    </p>
                  ) : null}
                </Field>
              );
            });
          })}
        </div>
        <Field
          id="door-totals-notes"
          label="Notes (optional)"
          error={errors.notes?.[0]}
        >
          <Textarea
            id="door-totals-notes"
            value={draft.notes}
            maxLength={500}
            rows={2}
            onChange={(event) => update("notes", event.target.value)}
          />
        </Field>
        <div className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold tabular-nums" aria-live="polite">
            {summary
              ? `${summary.tickets} tickets · ${formatNZD(summary.revenueCents)}`
              : "Check the ticket counts and amounts."}
          </p>
          <Button type="submit" disabled={!dirty || save.isPending}>
            {save.isPending ? "Saving…" : "Save door totals"}
          </Button>
        </div>
      </fieldset>
      <p className="text-muted-foreground mt-3 text-xs">
        Saving replaces the previous tally. No tickets are issued or emails
        sent.
        {totals
          ? ` Last saved ${formatEventDateTime(totals.updatedAt, timezone)}.`
          : ""}
      </p>
    </form>
  );
}
