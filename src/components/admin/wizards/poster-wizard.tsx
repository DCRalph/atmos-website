"use client";

import { useState } from "react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { PosterField } from "~/components/admin/gig-edit/poster-field";
import type { PosterDraft } from "~/components/admin/gig-edit/types";
import { gigPath } from "~/lib/gig-url";
import { GigGate } from "./gates";
import {
  gigEditorHref,
  gigLabel,
  posterChange,
  usePosterCommit,
  type EditorGig,
} from "./gig-common";
import { DiffList, Loading, type DiffRow } from "./parts";
import { DonePanel, useSteps, WizardFooter, WizardShell } from "./shell";

const STEPS = [
  { key: "poster", label: "Poster" },
  { key: "wide", label: "Wide version" },
  { key: "review", label: "Review" },
] as const;

/** Upload a poster: the portrait one, then optionally the wide one, then Save. */
export function PosterWizard() {
  return (
    <GigGate
      wizard="poster"
      hint={(gig) => (gig.hasPoster ? null : "No poster")}
    >
      {(gigId) => <Loaded gigId={gigId} />}
    </GigGate>
  );
}

function Loaded({ gigId }: { gigId: string }) {
  const gig = api.gigs.getForEditor.useQuery({ id: gigId });
  if (gig.isPending) {
    return (
      <WizardShell wizard="poster">
        <Loading />
      </WizardShell>
    );
  }
  if (!gig.data) {
    return (
      <WizardShell wizard="poster">
        <p className="text-sm">That gig is gone.</p>
      </WizardShell>
    );
  }
  return <Steps gig={gig.data} />;
}

function Steps({ gig }: { gig: EditorGig }) {
  const utils = api.useUtils();
  const steps = useSteps(STEPS);
  const [poster, setPoster] = useState<PosterDraft>({ kind: "keep" });
  const [wide, setWide] = useState<PosterDraft>({ kind: "keep" });
  const [isSaving, setIsSaving] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const { commit, progressOf } = usePosterCommit();

  const rows: DiffRow[] = [];
  const posterRow = posterChange(poster, Boolean(gig.posterFileUpload));
  if (posterRow) rows.push({ label: "Poster", ...posterRow });
  const wideRow = posterChange(wide, Boolean(gig.widePosterFileUpload));
  if (wideRow) rows.push({ label: "Wide poster", ...wideRow });

  const save = async () => {
    setIsSaving(true);
    try {
      await commit(gig.id, "poster", poster);
      await commit(gig.id, "wide", wide);
      await Promise.all([
        utils.gigs.getForEditor.invalidate({ id: gig.id }),
        utils.wizards.gigChoices.invalidate(),
      ]);
      toast.success("Poster saved");
      setIsDone(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    } finally {
      setIsSaving(false);
    }
  };

  const current = (file: EditorGig["posterFileUpload"]) =>
    file ? { fileUploadId: file.id, name: file.name } : null;

  return (
    <WizardShell
      wizard="poster"
      subtitle={gigLabel(gig)}
      editorHref={gigEditorHref(gig.id)}
      steps={steps}
      isDirty={rows.length > 0}
      done={
        isDone ? (
          <DonePanel
            title="Poster saved"
            description="It shows on the gig page and in the gig list now."
            next={[
              { key: "lineup", gigId: gig.id },
              { key: "gig-basics", gigId: gig.id },
            ]}
            links={[
              {
                href: gigPath({ id: gig.id, slug: gig.slug, isTba: gig.isTba }),
                label: "See the gig page",
                external: true,
              },
            ]}
          />
        ) : undefined
      }
    >
      {steps.step === "poster" ? (
        <>
          <PosterField
            gigTitle={gig.title}
            current={current(gig.posterFileUpload)}
            draft={poster}
            onChange={setPoster}
            uploadProgress={progressOf("poster")}
            disabled={isSaving}
          />
          <WizardFooter onNext={steps.next} />
        </>
      ) : null}

      {steps.step === "wide" ? (
        <>
          <PosterField
            shape="wide"
            gigTitle={gig.title}
            current={current(gig.widePosterFileUpload)}
            draft={wide}
            onChange={setWide}
            uploadProgress={progressOf("wide")}
            disabled={isSaving}
          />
          <WizardFooter
            onBack={steps.back}
            onNext={steps.next}
            hint={
              wide.kind === "keep" && !gig.widePosterFileUpload
                ? "Optional. Skip it if you only have the portrait one."
                : undefined
            }
          />
        </>
      ) : null}

      {steps.step === "review" ? (
        <>
          <DiffList
            rows={rows}
            empty="No new poster picked. Go back a step to choose one."
          />
          <WizardFooter
            onBack={steps.back}
            label="Save poster"
            onNext={() => void save()}
            disabled={rows.length === 0}
            isPending={isSaving}
          />
        </>
      ) : null}
    </WizardShell>
  );
}
