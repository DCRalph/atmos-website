"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { GigMediaManager } from "~/components/admin/gig-media-manager";
import { gigPath } from "~/lib/gig-url";
import { GigGate } from "./gates";
import { gigEditorHref, gigLabel, type EditorGig } from "./gig-common";
import { Loading } from "./parts";
import { DonePanel, useSteps, WizardFooter, WizardShell } from "./shell";

const STEPS = [
  { key: "photos", label: "Photos" },
  { key: "email", label: "Tell people" },
] as const;

/**
 * After the night: put the photos up, pick a few to feature, and email the
 * people who left their address on the photo signup page.
 *
 * Unlike the other wizards nothing waits for a Save: the gallery applies as
 * it goes, as it does in the full editor, and the email is its own button.
 */
export function AfterNightWizard() {
  return (
    <GigGate
      wizard="after-night"
      hint={(gig) => (gig.isPast && gig.photos === 0 ? "No photos" : null)}
    >
      {(gigId) => <Loaded gigId={gigId} />}
    </GigGate>
  );
}

function Loaded({ gigId }: { gigId: string }) {
  const gig = api.gigs.getForEditor.useQuery({ id: gigId });
  if (gig.isPending || !gig.data) {
    return (
      <WizardShell wizard="after-night">
        {gig.isPending ? (
          <Loading />
        ) : (
          <p className="text-sm">That gig is gone.</p>
        )}
      </WizardShell>
    );
  }
  return <Steps gig={gig.data} onRefetch={() => void gig.refetch()} />;
}

function Steps({ gig, onRefetch }: { gig: EditorGig; onRefetch: () => void }) {
  const utils = api.useUtils();
  const steps = useSteps(STEPS);
  const [sent, setSent] = useState<number | null>(null);
  const signups = api.photoSignup.forGig.useQuery({ gigId: gig.id });

  const send = api.photoSignup.sendPhotos.useMutation({
    onSuccess: async ({ sent: count, failed }) => {
      await utils.photoSignup.forGig.invalidate({ gigId: gig.id });
      if (failed) {
        toast.error(`Sent ${count}, ${failed} failed. Try again.`);
        return;
      }
      setSent(count);
    },
    onError: (error) => toast.error(error.message),
  });

  const photos = gig.media.filter((item) => item.type === "photo").length;
  const pending = signups.data?.pending ?? 0;
  const publicPath = gigPath({ id: gig.id, slug: gig.slug, isTba: gig.isTba });

  const finish = () => {
    void utils.wizards.gigChoices.invalidate();
    setSent(0);
  };

  return (
    <WizardShell
      wizard="after-night"
      subtitle={gigLabel(gig)}
      editorHref={gigEditorHref(gig.id)}
      steps={steps}
      done={
        sent !== null ? (
          <DonePanel
            title={sent > 0 ? "Photos are up and people know" : "Photos are up"}
            description={
              sent > 0
                ? `Emailed ${sent} ${sent === 1 ? "person" : "people"} a link to the gallery.`
                : `${photos} photo${photos === 1 ? "" : "s"} in the gallery.`
            }
            links={[
              { href: publicPath, label: "See the gallery", external: true },
            ]}
          />
        ) : undefined
      }
    >
      {steps.step === "photos" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Photos</CardTitle>
              <CardDescription>
                Drop the photos in. Drag the best few into Featured, which shows
                first. Changes here apply straight away.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GigMediaManager
                gigId={gig.id}
                media={gig.media}
                onRefetch={() => {
                  onRefetch();
                  void utils.photoSignup.forGig.invalidate({ gigId: gig.id });
                }}
              />
            </CardContent>
          </Card>
          <WizardFooter
            onNext={steps.next}
            disabled={photos === 0}
            hint={photos === 0 ? "Add a photo first." : undefined}
          />
        </>
      ) : null}

      {steps.step === "email" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Tell the people who asked</CardTitle>
              <CardDescription>
                Everyone who left their email on the photo signup page gets one
                email with a link to the gallery. Anyone already emailed is
                skipped.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              {signups.isPending ? (
                <Loading what="Counting signups..." />
              ) : pending === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {signups.data && signups.data.totals.emails > 0
                    ? "Everyone who signed up has already been emailed."
                    : "Nobody signed up for this gig's photos."}
                </p>
              ) : (
                <>
                  <p className="text-sm">
                    {pending} {pending === 1 ? "person is" : "people are"}{" "}
                    waiting.
                  </p>
                  <Button
                    onClick={() => send.mutate({ gigId: gig.id })}
                    disabled={send.isPending || photos === 0}
                  >
                    <Send className="size-4" aria-hidden />
                    Email {pending} {pending === 1 ? "person" : "people"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
          <WizardFooter onBack={steps.back} label="Finish" onNext={finish} />
        </>
      ) : null}
    </WizardShell>
  );
}
