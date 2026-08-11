"use client";

import { useState } from "react";
import { Check, Copy, Globe, Link2, Lock, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { useConfirm } from "~/components/confirm-provider";

type AdminEvent = RouterOutputs["ticketEvents"]["byId"];

/**
 * The link to hand out.
 *
 * For a private event this is the whole access control: the key on the end of
 * it is a bearer credential, so the card says plainly that anyone holding the
 * link gets in, and rotating is right there for when it ends up somewhere it
 * shouldn't. Public and unlisted events show the same card so there's one
 * place to grab a link from either way.
 */
export function ShareLinkCard({ event }: { event: AdminEvent }) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState(event.shareUrl);
  const utils = api.useUtils();
  const confirm = useConfirm();

  const rotate = api.ticketEvents.rotateAccessKey.useMutation({
    onSuccess: (result) => {
      setUrl(result.shareUrl);
      toast.success("New link created. The old one no longer works.");
      void utils.ticketEvents.byId.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const isPrivate = event.visibility === "PRIVATE";
  const isUnlisted = event.visibility === "UNLISTED";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select the link and copy it manually.");
    }
  }

  return (
    <section className="rounded-lg border p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">
          {isPrivate ? "Invite link" : "Event link"}
        </h2>
        <Badge variant={isPrivate ? "default" : "secondary"}>
          {isPrivate ? (
            <>
              <Lock className="size-3" /> Private
            </>
          ) : isUnlisted ? (
            <>
              <Link2 className="size-3" /> Unlisted
            </>
          ) : (
            <>
              <Globe className="size-3" /> Public
            </>
          )}
        </Badge>
      </div>

      <p className="text-muted-foreground mt-1 text-sm">
        {isPrivate
          ? "Send this to the people you want there. The page won't open without the key on the end of it, and anyone who has the link can use it — treat it like a password."
          : isUnlisted
            ? "Not listed anywhere, but this URL works for anyone who ends up with it."
            : "Listed on the events page and on its gig."}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <code className="bg-muted min-w-0 flex-1 truncate rounded-md px-3 py-2 font-mono text-sm">
          {url}
        </code>
        <Button variant="outline" onClick={() => void copy()}>
          {copied ? (
            <>
              <Check className="size-4" /> Copied
            </>
          ) : (
            <>
              <Copy className="size-4" /> Copy
            </>
          )}
        </Button>
      </div>

      {isPrivate && (
        <div className="mt-4 border-t pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={rotate.isPending}
            onClick={async () => {
              const ok = await confirm({
                title: "Create a new link?",
                description:
                  "Every link already sent stops working immediately, including any a guest has forwarded. Everyone still invited will need the new one.",
                confirmLabel: "Create new link",
                variant: "destructive",
              });
              if (ok) rotate.mutate({ id: event.id });
            }}
          >
            <RefreshCw className="size-4" />
            {rotate.isPending ? "Rotating…" : "Rotate link"}
          </Button>
          <p className="text-muted-foreground mt-2 text-xs">
            Use this if the link gets forwarded somewhere it shouldn&apos;t.
            Tickets already bought are unaffected.
          </p>
        </div>
      )}
    </section>
  );
}
