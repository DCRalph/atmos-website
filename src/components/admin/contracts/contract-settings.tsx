"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import {
  CONTRACT_SETTING_KEYS,
  CONTRACT_VERSION,
  type ContractSettings as Settings,
} from "~/lib/contracts";
import { api } from "~/trpc/react";

const NAMES = Object.keys(CONTRACT_SETTING_KEYS) as (keyof Settings)[];

/**
 * Site-wide contract settings: who Atmos legally is, who to call, the bond a
 * hire starts on and the version label in the masthead.
 *
 * Stored in the key-value store so they change without a deploy. They are
 * what a new contract starts with. A contract that has been saved keeps the
 * legal entity and version it was saved under, and its page says so when a
 * draft has fallen behind.
 */
export function ContractSettings() {
  const settings = api.settings.getAll.useQuery();

  if (settings.isPending) return <Skeleton className="h-64 w-full" />;

  const byKey = new Map(
    (settings.data ?? []).map((row) => [row.key, row.value]),
  );
  const initial = Object.fromEntries(
    NAMES.map((name) => [name, byKey.get(CONTRACT_SETTING_KEYS[name]) ?? ""]),
  ) as Settings;

  // Remounting on the loaded values keeps this a plain form over server state.
  return <SettingsForm key={settings.dataUpdatedAt} initial={initial} />;
}

function SettingsForm({ initial }: { initial: Settings }) {
  const utils = api.useUtils();
  const [values, setValues] = useState(initial);
  const upsert = api.settings.upsert.useMutation();

  async function save() {
    try {
      for (const name of NAMES) {
        await upsert.mutateAsync({
          key: CONTRACT_SETTING_KEYS[name],
          value: values[name].trim(),
        });
      }
      toast.success("Contract settings saved");
      void utils.settings.getAll.invalidate();
    } catch {
      toast.error("Couldn't save those settings.");
    }
  }

  const field = (name: keyof Settings) => ({
    id: `contract-${name}`,
    value: values[name],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      setValues((current) => ({ ...current, [name]: event.target.value })),
  });

  return (
    <div className="max-w-2xl space-y-6 rounded-lg border p-5">
      <div>
        <h2 className="text-xl font-semibold">Contracts</h2>
        <p className="text-muted-foreground text-sm">
          What every new performer and equipment hire agreement starts with.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contract-legalEntity">Legal entity</Label>
          <Input {...field("legalEntity")} placeholder="Company name" />
          <p className="text-muted-foreground text-xs">
            Named as the party to each contract, trading as Atmos Media. Blank
            names only Atmos Media.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contract-nzbn">NZBN</Label>
          <Input {...field("nzbn")} inputMode="numeric" />
          <p className="text-muted-foreground text-xs">
            Printed after the legal entity.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contract-contactPhone">Contact phone</Label>
          <Input {...field("contactPhone")} type="tel" />
          <p className="text-muted-foreground text-xs">
            Printed beside the name of whoever generates the contract.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contract-defaultBond">Default bond</Label>
          <Input {...field("defaultBond")} placeholder="500 or 20%" />
          <p className="text-muted-foreground text-xs">
            A dollar amount, or a percentage of what the hired gear would cost
            to replace. Each hire can change it.
          </p>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="contract-versionLabel">Version label</Label>
          <Input {...field("versionLabel")} placeholder={CONTRACT_VERSION} />
          <p className="text-muted-foreground text-xs">
            Shown in the corner of every contract. Change it when the terms
            change.
          </p>
        </div>
      </div>

      <Button onClick={() => void save()} disabled={upsert.isPending}>
        {upsert.isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Saving…
          </>
        ) : (
          "Save contract settings"
        )}
      </Button>
    </div>
  );
}
