"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";

/** `1000` -> `"10"`, `1250` -> `"12.50"`: cents as the amount inputs show them. */
export const dollarText = (cents: number) =>
  cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);

/**
 * The gig's donate page: whether there is one, and the three amounts it
 * suggests. The amounts stay editable while it is off, so they can be set up
 * before the switch goes on. `amounts` is dollar text, parsed on save.
 */
export function DonationsField({
  enabled,
  amounts,
  onEnabledChange,
  onAmountsChange,
  error,
  disabled,
}: {
  enabled: boolean;
  amounts: string[];
  onEnabledChange: (enabled: boolean) => void;
  onAmountsChange: (amounts: string[]) => void;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Donations</CardTitle>
        <CardDescription>
          A Donate button on the gig page, opening its own page
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="border-input flex cursor-pointer items-start gap-3 rounded-md border p-3">
          <Switch
            checked={enabled}
            onCheckedChange={onEnabledChange}
            disabled={disabled}
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">Accept donations</span>
            <span className="text-muted-foreground text-xs">
              Paid through Stripe. Off by default on every gig.
            </span>
          </span>
        </label>

        <div className="flex flex-col gap-2">
          <Label htmlFor="gig-donation-0">Suggested amounts</Label>
          <div className="grid grid-cols-3 gap-2">
            {amounts.map((amount, index) => (
              <div key={index} className="relative">
                <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                  $
                </span>
                <Input
                  id={`gig-donation-${index}`}
                  aria-label={`Suggested amount ${index + 1}`}
                  inputMode="decimal"
                  className="pl-6 tabular-nums"
                  value={amount}
                  onChange={(e) =>
                    onAmountsChange(
                      amounts.map((current, i) =>
                        i === index ? e.target.value : current,
                      ),
                    )
                  }
                  aria-invalid={Boolean(error)}
                  disabled={disabled}
                />
              </div>
            ))}
          </div>
          {error ? (
            <p className="text-destructive text-xs">{error}</p>
          ) : (
            <p className="text-muted-foreground text-xs">
              The middle one starts picked. People can also enter their own.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
