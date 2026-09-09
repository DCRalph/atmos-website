"use client";

import Link from "next/link";
import { ArrowRight, ExternalLink, Loader2 } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { DateTimePicker } from "~/components/ui/datetime-picker";
import { Label } from "~/components/ui/label";
import { TagsField } from "~/components/admin/gig-edit/tags-field";
import { GigMode } from "~Prisma/browser";
import type { GigExtraction } from "~/lib/gig-import/extraction";
import { ProvenanceField } from "./provenance-field";
import type { ImportDraft } from "./use-import-draft";

/**
 * Step two: everything the post said, next to the post.
 *
 * Only the fields import actually fills are here. The description is written
 * but shown read-only, because editing rich text belongs in the gig editor and
 * putting a second Lexical instance on this page would mean two places that
 * have to agree about what a description is.
 */
export function StepReview({
  extraction,
  draft,
  imported,
  update,
  onRevert,
  gigId,
  descriptionPreview,
  isSaving,
  onContinue,
}: {
  extraction: GigExtraction;
  draft: ImportDraft;
  /** What the import put in each field, for comparison and for reverting. */
  imported: ImportDraft;
  update: <K extends keyof ImportDraft>(key: K, value: ImportDraft[K]) => void;
  onRevert: <K extends keyof ImportDraft>(key: K) => void;
  gigId: string;
  /** The written description as plain text, for the read-only preview. */
  descriptionPreview: string;
  isSaving: boolean;
  onContinue: () => void;
}) {
  const changed = <K extends keyof ImportDraft>(key: K) =>
    JSON.stringify(draft[key]) !== JSON.stringify(imported[key]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Core details</CardTitle>
              <CardDescription>
                Change anything. An edited field keeps a way back to what was
                read.
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/admin/gigs/${gigId}`} target="_blank">
                <ExternalLink className="size-4" aria-hidden />
                Open in the full editor
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ProvenanceField
              id="import-title"
              label="Title"
              required
              marker="title"
              confidence={extraction.title.confidence}
              quote={extraction.title.quote}
              note={extraction.title.note}
              isEdited={changed("title")}
              importedLabel={imported.title}
              onRevert={() => onRevert("title")}
              error={draft.title.trim() ? undefined : "A gig needs a title"}
            >
              <Input
                id="import-title"
                value={draft.title}
                onChange={(event) => update("title", event.target.value)}
              />
            </ProvenanceField>

            <ProvenanceField
              id="import-subtitle"
              label="Subtitle (venue)"
              required
              marker="venue"
              confidence={extraction.venue.confidence}
              quote={extraction.venue.quote}
              note={extraction.venue.note}
              isEdited={changed("subtitle")}
              importedLabel={imported.subtitle}
              onRevert={() => onRevert("subtitle")}
              error={draft.subtitle.trim() ? undefined : "A gig needs a venue"}
            >
              <Input
                id="import-subtitle"
                value={draft.subtitle}
                onChange={(event) => update("subtitle", event.target.value)}
              />
            </ProvenanceField>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ProvenanceField
              id="import-start"
              label="Starts"
              required
              marker="startsAt"
              confidence={extraction.startsAt.confidence}
              quote={extraction.startsAt.quote}
              note={extraction.startsAt.note}
              isEdited={changed("startTime")}
              importedLabel={
                imported.startTime ? formatWhen(imported.startTime) : null
              }
              onRevert={() => onRevert("startTime")}
              error={draft.startTime ? undefined : "A gig needs a start time"}
            >
              <DateTimePicker
                date={draft.startTime}
                onDateChange={(date) => update("startTime", date)}
              />
            </ProvenanceField>

            <ProvenanceField
              id="import-end"
              label="Ends"
              marker="endsAt"
              confidence={extraction.endsAt.confidence}
              quote={extraction.endsAt.quote}
              note={extraction.endsAt.note}
              isEdited={changed("endTime")}
              importedLabel={
                imported.endTime ? formatWhen(imported.endTime) : null
              }
              onRevert={() => onRevert("endTime")}
              hint="Leave empty if the post did not say."
            >
              <DateTimePicker
                date={draft.endTime}
                onDateChange={(date) => update("endTime", date)}
                placeholder="No end time"
              />
            </ProvenanceField>
          </div>

          <ProvenanceField
            id="import-short-description"
            label="Short description"
            confidence={extraction.shortDescription.confidence}
            quote={extraction.shortDescription.quote}
            note={extraction.shortDescription.note}
            isEdited={changed("shortDescription")}
            importedLabel={imported.shortDescription}
            onRevert={() => onRevert("shortDescription")}
            hint="Used on cards and listings."
          >
            <Textarea
              id="import-short-description"
              rows={3}
              value={draft.shortDescription}
              onChange={(event) =>
                update("shortDescription", event.target.value)
              }
            />
          </ProvenanceField>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Label>Description</Label>
              <span className="text-muted-foreground ml-auto text-xs">
                Written from the caption. Edit it in the full editor.
              </span>
            </div>
            <div className="border-input bg-input/30 text-muted-foreground max-h-40 overflow-auto rounded-md border px-3 py-2 text-sm whitespace-pre-wrap">
              {descriptionPreview.trim() ||
                "The post had nothing worth keeping as a description."}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ProvenanceField
              id="import-mode"
              label="Mode"
              confidence={extraction.mode.confidence}
              quote={extraction.mode.quote}
              note={
                extraction.mode.note ||
                "To be announced hides the details and blurs the poster."
              }
              isEdited={changed("mode")}
              importedLabel={
                imported.mode === GigMode.TO_BE_ANNOUNCED
                  ? "To be announced"
                  : "Normal"
              }
              onRevert={() => onRevert("mode")}
            >
              <Select
                value={draft.mode}
                onValueChange={(value) => update("mode", value as GigMode)}
              >
                <SelectTrigger id="import-mode" className="w-full">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={GigMode.NORMAL}>Normal</SelectItem>
                  <SelectItem value={GigMode.TO_BE_ANNOUNCED}>
                    To be announced
                  </SelectItem>
                </SelectContent>
              </Select>
            </ProvenanceField>

            <ProvenanceField
              id="import-ticket-link"
              label="Ticket link"
              marker="ticketUrl"
              confidence={extraction.ticketUrl.confidence}
              quote={extraction.ticketUrl.quote}
              note={extraction.ticketUrl.note}
              isEdited={changed("ticketLink")}
              importedLabel={imported.ticketLink}
              onRevert={() => onRevert("ticketLink")}
              hint="Leave empty if tickets are sold on this site."
            >
              <Input
                id="import-ticket-link"
                type="url"
                value={draft.ticketLink}
                placeholder="https://example.com/tickets"
                onChange={(event) => update("ticketLink", event.target.value)}
              />
            </ProvenanceField>
          </div>
        </CardContent>
      </Card>

      <TagsField
        tagIds={draft.tagIds}
        onChange={(tagIds) => update("tagIds", tagIds)}
      />

      {(extraction.tags.value ?? []).length > draft.tagIds.length ? (
        <p className="text-muted-foreground text-xs">
          Import only ever matches tags that already exist. Anything the post
          said that has no tag was dropped.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onContinue} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Saving...
            </>
          ) : (
            <>
              Continue to line-up
              <ArrowRight className="size-4" aria-hidden />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

const formatWhen = (date: Date) =>
  date.toLocaleString("en-NZ", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
