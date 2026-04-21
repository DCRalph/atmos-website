"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Loader2 } from "lucide-react";
import { api } from "~/trpc/react";
import { GigMode } from "~Prisma/browser";
import { LexicalMarkdownEditor } from "~/components/admin/lexical-markdown-editor";
import {
  SaveStatusPill,
  useSaveStatus,
} from "~/components/admin/gig-edit/save-status";

type CoreDetailsCardProps = {
  gig: {
    id: string;
    title: string;
    subtitle: string;
    shortDescription: string | null;
    longDescription: string | null;
    mode: GigMode | null;
    ticketLink: string | null;
  };
  onSaved: () => Promise<unknown> | void;
  onDirtyChange?: (dirty: boolean) => void;
};

export function CoreDetailsCard({
  gig,
  onSaved,
  onDirtyChange,
}: CoreDetailsCardProps) {
  const { status, errorMessage, markDirty, markSaving, markSaved, markError } =
    useSaveStatus({ onDirtyChange });

  const [title, setTitle] = useState(gig.title);
  const [subtitle, setSubtitle] = useState(gig.subtitle);
  const [shortDescription, setShortDescription] = useState(
    gig.shortDescription ?? "",
  );
  const [longDescription, setLongDescription] = useState(
    gig.longDescription ?? "",
  );
  const [mode, setMode] = useState<GigMode>(gig.mode ?? GigMode.NORMAL);
  const [ticketLink, setTicketLink] = useState(gig.ticketLink ?? "");

  useEffect(() => {
    setTitle(gig.title);
    setSubtitle(gig.subtitle);
    setShortDescription(gig.shortDescription ?? "");
    setLongDescription(gig.longDescription ?? "");
    setMode(gig.mode ?? GigMode.NORMAL);
    setTicketLink(gig.ticketLink ?? "");
  }, [
    gig.id,
    gig.title,
    gig.subtitle,
    gig.shortDescription,
    gig.longDescription,
    gig.mode,
    gig.ticketLink,
  ]);

  const update = api.gigs.update.useMutation({
    onSuccess: async () => {
      await onSaved();
      markSaved();
      toast.success("Details saved");
    },
    onError: (err) => {
      markError(err.message);
      toast.error(err.message || "Failed to save details");
    },
  });

  const handleChange = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value);
    markDirty();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !subtitle.trim()) {
      toast.error("Title and subtitle are required");
      return;
    }
    markSaving();
    update.mutate({
      id: gig.id,
      title: title.trim(),
      subtitle: subtitle.trim(),
      shortDescription: shortDescription.trim(),
      longDescription: longDescription.trim() || null,
      mode,
      ticketLink: ticketLink.trim() || null,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Core Details</CardTitle>
            <CardDescription>
              Title, description, mode, and ticket link
            </CardDescription>
          </div>
          <SaveStatusPill status={status} errorMessage={errorMessage} />
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => handleChange(setTitle)(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="subtitle">Subtitle</Label>
              <Input
                id="subtitle"
                value={subtitle}
                onChange={(e) => handleChange(setSubtitle)(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="shortDescription">Short Description</Label>
            <Textarea
              id="shortDescription"
              value={shortDescription}
              onChange={(e) =>
                handleChange(setShortDescription)(e.target.value)
              }
              placeholder="Short summary used in cards and listings..."
              rows={3}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Long Description</Label>
            <LexicalMarkdownEditor
              value={longDescription}
              onChange={handleChange(setLongDescription)}
              placeholder="Describe the gig, line-up, venue info..."
              ariaLabel="Long description"
              minHeight="14rem"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Mode</Label>
              <Select
                value={mode}
                onValueChange={(value) => handleChange(setMode)(value as GigMode)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={GigMode.NORMAL}>Normal</SelectItem>
                  <SelectItem value={GigMode.TO_BE_ANNOUNCED}>
                    To Be Announced
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                To Be Announced hides details and shows a blurred poster.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ticketLink">Ticket Link (optional)</Label>
              <Input
                id="ticketLink"
                type="url"
                value={ticketLink}
                onChange={(e) => handleChange(setTicketLink)(e.target.value)}
                placeholder="https://example.com/tickets"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t pt-4">
            {status === "error" && errorMessage ? (
              <p className="text-destructive mr-auto text-sm">{errorMessage}</p>
            ) : null}
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Details"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
