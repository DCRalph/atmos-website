"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import { parsePriceToCents } from "~/lib/ticketing/money";

/**
 * Site-wide ticketing settings.
 *
 * Stored in the key-value store so they can change without a deploy. Each
 * event can override the booking fee; everything else here applies everywhere.
 * The GST number in particular ends up printed on receipts, so it is worth
 * getting right before the first sale.
 */

const KEYS = {
  bookingFeeFixedCents: "ticketing.bookingFee.fixedCents",
  bookingFeePercentBp: "ticketing.bookingFee.percentBp",
  gstNumber: "ticketing.gstNumber",
  supportEmail: "ticketing.supportEmail",
  legalName: "ticketing.legalName",
  holdMinutes: "ticketing.holdMinutes",
} as const;

export function TicketingSettings() {
  const settings = api.settings.getAll.useQuery();

  if (settings.isPending) return <Skeleton className="h-64 w-full" />;

  const byKey = Object.fromEntries(
    (settings.data ?? []).map((row) => [row.key, row.value]),
  );

  // Remounting on the loaded values (rather than syncing them into state in an
  // effect) keeps this a plain uncontrolled-from-server form with no cascading
  // render.
  return (
    <SettingsForm
      key={settings.dataUpdatedAt}
      initial={{
        feeFixed: byKey[KEYS.bookingFeeFixedCents]
          ? (Number(byKey[KEYS.bookingFeeFixedCents]) / 100).toFixed(2)
          : "",
        feePercent: byKey[KEYS.bookingFeePercentBp]
          ? String(Number(byKey[KEYS.bookingFeePercentBp]) / 100)
          : "",
        gstNumber: byKey[KEYS.gstNumber] ?? "",
        supportEmail: byKey[KEYS.supportEmail] ?? "",
        legalName: byKey[KEYS.legalName] ?? "Atmos Media",
        holdMinutes: byKey[KEYS.holdMinutes] ?? "10",
      }}
    />
  );
}

function SettingsForm({ initial }: { initial: Record<string, string> }) {
  const utils = api.useUtils();
  const [values, setValues] = useState<Record<string, string>>(initial);
  const upsert = api.settings.upsert.useMutation();

  async function save() {
    const writes: { key: string; value: string }[] = [
      {
        key: KEYS.bookingFeeFixedCents,
        value: String(parsePriceToCents(values.feeFixed ?? "0") ?? 0),
      },
      {
        key: KEYS.bookingFeePercentBp,
        value: String(
          Math.round(Number.parseFloat(values.feePercent ?? "0") * 100) || 0,
        ),
      },
      { key: KEYS.gstNumber, value: values.gstNumber ?? "" },
      { key: KEYS.supportEmail, value: values.supportEmail ?? "" },
      { key: KEYS.legalName, value: values.legalName ?? "Atmos Media" },
      { key: KEYS.holdMinutes, value: values.holdMinutes ?? "10" },
    ];

    try {
      for (const write of writes) {
        await upsert.mutateAsync(write);
      }
      toast.success("Ticketing settings saved");
      void utils.settings.getAll.invalidate();
    } catch {
      toast.error("Couldn't save those settings.");
    }
  }

  const field = (key: string) => ({
    value: values[key] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setValues((current) => ({ ...current, [key]: e.target.value })),
  });

  return (
    <div className="max-w-2xl space-y-6 rounded-lg border p-5">
      <div>
        <h2 className="text-xl font-semibold">Ticketing</h2>
        <p className="text-muted-foreground text-sm">
          Defaults for every ticketed event. Individual events can override the
          booking fee.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="fee-fixed">Booking fee per ticket (NZD)</Label>
          <Input id="fee-fixed" inputMode="decimal" {...field("feeFixed")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fee-percent">Booking fee percentage</Label>
          <Input
            id="fee-percent"
            inputMode="decimal"
            {...field("feePercent")}
          />
          <p className="text-muted-foreground text-xs">
            Both can be zero. Whatever you set is disclosed on the event page,
            not just at checkout.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="gst">GST number</Label>
          <Input id="gst" {...field("gstNumber")} placeholder="123-456-789" />
          <p className="text-muted-foreground text-xs">
            Printed on receipts so they count as taxable supply information.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="legal">Legal name</Label>
          <Input id="legal" {...field("legalName")} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="support">Support email</Label>
          <Input
            id="support"
            type="email"
            {...field("supportEmail")}
            placeholder="tickets@atmosmedia.co.nz"
          />
          <p className="text-muted-foreground text-xs">
            Used as reply-to on ticket emails.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hold">Checkout hold (minutes)</Label>
          <Input
            id="hold"
            type="number"
            min={1}
            max={60}
            {...field("holdMinutes")}
          />
          <p className="text-muted-foreground text-xs">
            How long tickets stay reserved while someone is paying.
          </p>
        </div>
      </div>

      <Button onClick={() => void save()} disabled={upsert.isPending}>
        {upsert.isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Saving…
          </>
        ) : (
          "Save ticketing settings"
        )}
      </Button>
    </div>
  );
}
