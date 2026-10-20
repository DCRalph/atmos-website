"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { ImageUploadField } from "~/components/uploads/image-upload-field";
import { api } from "~/trpc/react";
import type { PickedVenue } from "./venue-picker";

type VenueDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The venue being edited. Absent creates a new one. */
  venue?: PickedVenue;
  /** Prefills a new venue's name, from whatever was typed into a picker. */
  initialName?: string;
  /** Says what happens to a new venue, e.g. "Create & use for this gig". */
  createLabel?: string;
  onSaved: (venue: PickedVenue) => void;
};

/**
 * Creates or edits a venue. Used on the venues page and, for creating, from
 * the gig and event editors' venue pickers so nobody has to leave the page.
 */
export function VenueDialog({
  open,
  onOpenChange,
  venue,
  initialName = "",
  createLabel = "Create venue",
  onSaved,
}: VenueDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Mounted only while open, so every visit starts from a clean form. */}
        {open ? (
          <VenueForm
            venue={venue}
            initialName={initialName}
            createLabel={createLabel}
            onSaved={(saved) => {
              onSaved(saved);
              onOpenChange(false);
            }}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function VenueForm({
  venue,
  initialName,
  createLabel,
  onSaved,
  onClose,
}: {
  venue?: PickedVenue;
  initialName: string;
  createLabel: string;
  onSaved: (venue: PickedVenue) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(venue?.name ?? initialName);
  const [address, setAddress] = useState(venue?.address ?? "");
  const [logoFileId, setLogoFileId] = useState(venue?.logoFileId ?? null);
  const utils = api.useUtils();

  const onSuccess = (saved: PickedVenue) => {
    toast.success(venue ? "Venue saved" : `Created ${saved.name}`);
    void utils.venues.list.invalidate();
    onSaved({
      id: saved.id,
      name: saved.name,
      address: saved.address,
      logoFileId: saved.logoFileId,
    });
  };
  const onError = (error: { message: string }) => toast.error(error.message);
  const create = api.venues.create.useMutation({ onSuccess, onError });
  const update = api.venues.update.useMutation({ onSuccess, onError });
  const isPending = create.isPending || update.isPending;
  const canSubmit = name.trim().length > 0 && !isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const fields = { name, address, logoFileId };
    if (venue) update.mutate({ id: venue.id, ...fields });
    else create.mutate(fields);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{venue ? "Edit venue" : "New venue"}</DialogTitle>
        <DialogDescription>
          {venue
            ? "Changes show on every gig and event at this venue."
            : "Shown with its logo on the gigs and events it is picked for."}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-2">
        <Label htmlFor="venue-name">Name</Label>
        <Input
          id="venue-name"
          autoFocus
          placeholder="Whammy Bar"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="venue-address">Address</Label>
        <Input
          id="venue-address"
          placeholder="183 Karangahape Road, Auckland"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </div>
      <ImageUploadField
        preset="venueLogo"
        value={logoFileId}
        onChange={setLogoFileId}
        label="Logo"
        aspect="square"
        disabled={isPending}
      />

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {venue ? "Save" : createLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
