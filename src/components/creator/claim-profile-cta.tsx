"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

export function ClaimProfileCTA({
  profileId,
  handle,
}: {
  profileId: string;
  handle: string;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const claim = api.creatorProfiles.requestClaim.useMutation({
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  return (
    <>
      <div className="rounded-md border border-amber-500/60 bg-amber-500/10 p-4 text-sm flex items-center justify-between gap-3">
        <div>
          This profile is <b>unclaimed</b>. If this is you, you can request to
          claim it.
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          Request to claim
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Claim @{handle}</DialogTitle>
            <DialogDescription>
              {submitted
                ? "Your claim request was submitted. An admin will review it shortly."
                : "Tell the admins how you can verify this is you. We'll reach out if we need more info."}
            </DialogDescription>
          </DialogHeader>
          {!submitted && (
            <div className="py-2">
              <Textarea
                rows={4}
                placeholder="I'm the DJ behind this name. You can verify by..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              {claim.error && (
                <p className="text-destructive mt-2 text-sm">
                  {claim.error.message}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {submitted ? "Close" : "Cancel"}
            </Button>
            {!submitted && (
              <Button
                onClick={() =>
                  claim.mutate({ profileId, message: message || undefined })
                }
                disabled={claim.isPending}
              >
                {claim.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit request"
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
