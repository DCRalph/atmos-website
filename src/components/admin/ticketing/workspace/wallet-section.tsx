"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { PassThemeField } from "~/components/admin/ticketing/pass-theme-field";
import type { EventDraftState } from "./use-event-draft";

/** How the Apple and Google Wallet passes look. Part of the draft. */
export function WalletSection({ state }: { state: EventDraftState }) {
  const { draft, update } = state;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Wallet pass</CardTitle>
        <CardDescription>
          Apple and Google Wallet styling. Saving pushes the new look to passes
          already on phones.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PassThemeField
          value={draft.passTheme}
          onChange={(passTheme) => update("passTheme", passTheme)}
          eventName={draft.name}
        />
      </CardContent>
    </Card>
  );
}
