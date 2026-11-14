"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { api, type RouterOutputs } from "~/trpc/react";

type Saved = RouterOutputs["artistProfiles"]["privateDetails"];

/**
 * An artist's paperwork details on the admin artist sheet: who they legally
 * are and where they are paid. These fill the performer agreement and are
 * never shown on the artist's page.
 */
export function ArtistPrivateDetails({ profileId }: { profileId: string }) {
  const { data } = api.artistProfiles.privateDetails.useQuery({ profileId });
  if (!data) return null;
  return (
    <PrivateDetailsForm
      // Remounts after every save, so the form restarts from what was stored.
      key={data.updatedAt?.getTime() ?? 0}
      profileId={profileId}
      saved={data}
    />
  );
}

function PrivateDetailsForm({
  profileId,
  saved,
}: {
  profileId: string;
  saved: Saved;
}) {
  const utils = api.useUtils();
  const initial = {
    legalName: saved.legalName,
    contactEmail: saved.contactEmail,
    phone: saved.phone,
    address: saved.address,
    gstNumber: saved.gstNumber,
    bankAccountName: saved.bankAccountName,
    // Never sent to the browser. Typing a number replaces the one on file.
    bankAccountNumber: "",
  };
  const [form, setForm] = useState(initial);
  const dirty = (Object.keys(initial) as (keyof typeof initial)[]).some(
    (key) => form[key].trim() !== initial[key],
  );

  const update = api.artistProfiles.updatePrivateDetails.useMutation({
    onSuccess: async () => {
      toast.success("Saved");
      await utils.artistProfiles.privateDetails.invalidate({ profileId });
    },
    onError: (error) => toast.error(error.message),
  });

  const field = (key: keyof typeof form) => ({
    id: `private-${key}`,
    value: form[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: event.target.value })),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        update.mutate({ profileId, ...form });
      }}
    >
      <div>
        <h3 className="text-sm leading-none font-medium">Private details</h3>
        <p className="text-muted-foreground mt-1 text-xs">
          Admins only. Used to fill contracts. Never shown on the artist&apos;s
          page.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="private-legalName">Legal name</Label>
        <Input {...field("legalName")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="private-contactEmail">Contact email</Label>
        <Input type="email" {...field("contactEmail")} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="private-phone">Phone</Label>
          <Input type="tel" {...field("phone")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="private-gstNumber">GST number</Label>
          <Input placeholder="Not registered" {...field("gstNumber")} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="private-address">Address</Label>
        <Input {...field("address")} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="private-bankAccountName">Bank account name</Label>
          <Input {...field("bankAccountName")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="private-bankAccountNumber">Bank account number</Label>
          <Input
            className="tabular-nums"
            autoComplete="off"
            placeholder={saved.bankAccountMasked || "None on file"}
            {...field("bankAccountNumber")}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        {dirty ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setForm(initial)}
            disabled={update.isPending}
          >
            Reset
          </Button>
        ) : null}
        <Button type="submit" disabled={!dirty || update.isPending}>
          {update.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : null}
          Save
        </Button>
      </div>
    </form>
  );
}
