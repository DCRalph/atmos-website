"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { AdminSection } from "~/components/admin/admin-section";
import { GigStatusBadge } from "~/components/admin/gig-status-badge";
import { Button } from "~/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { gigPath } from "~/lib/gig-url";
import { GigMode } from "~Prisma/browser";
import { SourcePanel } from "./source-panel";
import { StepLineUp } from "./step-line-up";
import { StepPublish, type ChecklistEntry } from "./step-publish";
import { StepRail, type ImportStep, IMPORT_STEPS } from "./step-rail";
import { StepReview } from "./step-review";
import { StepSource } from "./step-source";
import { useImportDraft, type ImportDraft } from "./use-import-draft";

/**
 * The import wizard.
 *
 * Four steps, and the gig is a real draft from the end of step one onwards.
 * That is the reason this is a wizard rather than a long form: reading a post
 * is a slow, fallible thing to do, and once it has been done the work has to
 * survive a closed tab. The import id lives in the URL so it does.
 */
export function ImportWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = api.useUtils();

  const importId = searchParams.get("import");
  const [isDiscarding, setIsDiscarding] = useState(false);

  // The step is derived rather than stored: an import id in the URL means the
  // reading has been done, so step one is behind us whether we arrived here by
  // finishing it or by opening the link. `chosen` is only the admin moving
  // around inside that, and `reached` is how far back the rail can go.
  const [chosen, setChosen] = useState<ImportStep | null>(null);
  const [reached, setReached] = useState(0);

  const step: ImportStep = chosen ?? (importId ? "review" : "source");
  const stepIndex = IMPORT_STEPS.findIndex((entry) => entry.key === step);
  const furthest = IMPORT_STEPS[Math.max(reached, stepIndex)]?.key ?? "source";

  const record = api.gigImport.get.useQuery(
    { importId: importId ?? "" },
    { enabled: Boolean(importId) },
  );

  const gigId = record.data?.gig?.id ?? null;
  const { gig, draft, update, setDraft, isSaving, save } =
    useImportDraft(gigId);

  const goTo = useCallback((next: ImportStep) => {
    setChosen(next);
    setReached((current) =>
      Math.max(
        current,
        IMPORT_STEPS.findIndex((entry) => entry.key === next),
      ),
    );
  }, []);

  const publish = api.gigImport.publish.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.gigs.getAll.invalidate(),
        utils.gigImport.get.invalidate(),
      ]);
      toast.success("The gig is live");
      if (gigId) router.push(`/admin/gigs/${gigId}`);
    },
    onError: (error) => toast.error(error.message),
  });

  const discard = api.gigImport.discard.useMutation({
    onSuccess: async () => {
      await utils.gigs.getAll.invalidate();
      toast.success("Draft discarded");
      router.push("/admin/gigs");
    },
    onError: (error) => toast.error(error.message),
  });

  /**
   * What the import originally wrote, so a field can say what it is reverting
   * to. Derived from the extraction rather than remembered from the first
   * render, which would be lost on a reload.
   */
  const imported = useMemo((): ImportDraft | null => {
    if (!record.data || !gig) return null;
    const { extraction } = record.data;
    return {
      title: extraction.title.value ?? gig.title,
      subtitle: extraction.venue.value ?? gig.subtitle,
      shortDescription: extraction.shortDescription.value ?? "",
      mode:
        extraction.mode.value === "TO_BE_ANNOUNCED"
          ? GigMode.TO_BE_ANNOUNCED
          : GigMode.NORMAL,
      ticketLink: extraction.ticketUrl.value ?? "",
      // The instants the import resolved are on the gig; the extraction only
      // holds the wall times it read them from.
      startTime: gig.gigStartTime ?? undefined,
      endTime: gig.gigEndTime ?? undefined,
      tagIds: gig.gigTags.map((row) => row.gigTag.id),
    };
  }, [record.data, gig]);

  const revert = useCallback(
    <K extends keyof ImportDraft>(key: K) => {
      if (!imported) return;
      setDraft((current) =>
        current ? { ...current, [key]: imported[key] } : current,
      );
    },
    [imported, setDraft],
  );

  const checklist = useMemo((): ChecklistEntry[] => {
    if (!record.data || !gig || !draft) return [];
    const { extraction, unresolvedHandles } = record.data;
    const pendingHandles = unresolvedHandles.map((entry) => entry.handle);
    const sets = gig.scheduleItems.filter((item) => item.kind === "SET");

    return [
      {
        label: "Title and venue",
        ok: Boolean(draft.title.trim() && draft.subtitle.trim()),
        detail: `${draft.title || "Untitled"}, ${draft.subtitle || "no venue"}`,
        step: "review",
      },
      {
        label: "Start time",
        ok: draft.mode !== GigMode.TO_BE_ANNOUNCED && Boolean(draft.startTime),
        detail:
          draft.mode === GigMode.TO_BE_ANNOUNCED
            ? "Publishing as to be announced"
            : (draft.startTime?.toLocaleString("en-NZ", {
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "numeric",
                minute: "2-digit",
              }) ?? "Not set"),
        step: "review",
      },
      {
        label: "End time",
        ok: Boolean(draft.endTime) && extraction.endsAt.confidence === "high",
        detail: draft.endTime
          ? extraction.endsAt.confidence === "high"
            ? "Read from the post"
            : "Guessed, not read"
          : "The post did not say",
        step: "review",
      },
      {
        label: "Poster",
        ok: Boolean(gig.posterFileUploadId),
        detail: gig.posterFileUploadId
          ? "Taken from the post"
          : "No image was usable",
        step: "lineup",
      },
      {
        label: "Line-up",
        ok: sets.length > 0,
        detail:
          sets.length > 0
            ? `${sets.length} set${sets.length === 1 ? "" : "s"}`
            : "Nobody on the bill",
        step: "lineup",
      },
      {
        label: "Every name placed",
        ok: pendingHandles.length === 0,
        detail:
          pendingHandles.length === 0
            ? "Everybody the post billed is on the bill"
            : `${pendingHandles.map((handle) => `@${handle}`).join(", ")} is not on the bill`,
        step: "lineup",
      },
    ];
  }, [record.data, gig, draft]);

  const isLoadingImport = Boolean(importId) && (record.isLoading || !draft);
  /** Narrowed once, so the publish step is not full of non-null assertions. */
  const gigForPublish = record.data?.gig?.id ?? "";

  return (
    <AdminSection
      title="Import a gig"
      subtitle={record.data?.gig?.title ?? undefined}
      backLink={{ href: "/admin/gigs", label: "Gigs" }}
      actions={
        <div className="flex items-center gap-2">
          {record.data?.gig ? (
            <GigStatusBadge
              status={record.data.gig.status}
              startsAt={gig?.gigStartTime ?? null}
              endsAt={gig?.gigEndTime ?? null}
            />
          ) : null}
          {importId && record.data?.gig?.status === "DRAFT" ? (
            <Button
              variant="destructive"
              onClick={() => setIsDiscarding(true)}
              disabled={discard.isPending}
            >
              <Trash2 className="size-4" aria-hidden />
              Discard
            </Button>
          ) : null}
        </div>
      }
    >
      <StepRail current={step} furthest={furthest} onSelect={goTo} />

      {!importId ? (
        <StepSource
          onImported={(result) => {
            if (!result.posterAttached) {
              toast.warning(
                "The post's image could not be saved. Add a poster at step three.",
              );
            }
            router.replace(`/admin/gigs/import?import=${result.importId}`);
            goTo("review");
          }}
        />
      ) : isLoadingImport ? (
        <div className="text-muted-foreground flex items-center gap-2 py-16 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading the draft...
        </div>
      ) : !record.data?.gig || !draft || !imported || !gig ? (
        <div className="border-border rounded-lg border p-6">
          <p className="text-sm">
            The draft this import made is gone. The record of what was read is
            still there, but there is nothing left to edit.
          </p>
          <Button variant="outline" className="mt-4" asChild>
            <Link href="/admin/gigs/import">
              <ArrowLeft className="size-4" aria-hidden />
              Start another import
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          {step !== "publish" ? (
            <SourcePanel
              post={record.data.post}
              extraction={record.data.extraction}
              posterUrl={
                gig.posterFileUpload
                  ? `/api/media/${gig.posterFileUpload.id}`
                  : null
              }
              className="xl:sticky xl:top-4 xl:col-span-4 xl:self-start"
            />
          ) : null}

          <div
            className={step === "publish" ? "xl:col-span-12" : "xl:col-span-8"}
          >
            {step === "review" ? (
              <StepReview
                extraction={record.data.extraction}
                draft={draft}
                imported={imported}
                update={update}
                onRevert={revert}
                gigId={record.data.gig.id}
                descriptionPreview={
                  record.data.extraction.description.value ?? ""
                }
                isSaving={isSaving}
                onContinue={async () => {
                  if (await save()) goTo("lineup");
                }}
              />
            ) : null}

            {step === "lineup" ? (
              <StepLineUp
                gigId={record.data.gig.id}
                importId={record.data.id}
                slots={gig.scheduleItems.filter((item) => item.kind === "SET")}
                unresolvedHandles={record.data.unresolvedHandles.map(
                  (entry) => entry.handle,
                )}
                posterFileUploadId={gig.posterFileUploadId}
                isSaving={isSaving}
                onContinue={() => goTo("publish")}
              />
            ) : null}

            {step === "publish" ? (
              <StepPublish
                gigId={gigForPublish}
                gigPath={gigPath({
                  id: gigForPublish,
                  title: draft.title,
                  mode: draft.mode,
                })}
                checklist={checklist}
                isPublishing={publish.isPending}
                onPublish={() => publish.mutate({ gigId: gigForPublish })}
                onGoToStep={goTo}
              />
            ) : null}
          </div>
        </div>
      )}

      <AlertDialog open={isDiscarding} onOpenChange={setIsDiscarding}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              The gig and its poster are deleted. The record of what was read
              from the post is kept, so the import can be looked at again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => importId && discard.mutate({ importId })}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminSection>
  );
}
