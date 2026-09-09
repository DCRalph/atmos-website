"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardPaste, Download, Loader2 } from "lucide-react";
import { FaInstagram } from "react-icons/fa6";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { GigStatusBadge } from "~/components/admin/gig-status-badge";

/**
 * Step one: where the gig is coming from.
 *
 * Two ways in, and the second one is not a fallback bolted on afterwards.
 * Instagram only hands over captions for accounts we own, so a post by the
 * venue or the promoter has to be pasted. The same extraction runs on both, so
 * the difference ends here.
 */
export function StepSource({
  onImported,
}: {
  onImported: (result: { importId: string; posterAttached: boolean }) => void;
}) {
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [mode, setMode] = useState<"instagram" | "caption">("instagram");

  const availability = api.gigImport.availability.useQuery();
  const recent = api.gigImport.recent.useQuery({ limit: 5 });
  const utils = api.useUtils();

  const read = api.gigImport.read.useMutation({
    onSuccess: async (result) => {
      await utils.gigImport.recent.invalidate();
      await utils.gigs.getAll.invalidate();
      onImported(result);
    },
    onError: (error) => {
      toast.error(error.message);
      // Instagram refusing a post is the common case, and pasting the caption
      // is what to do about it, so put the admin in front of that field.
      if (mode === "instagram") setMode("caption");
    },
  });

  const canExtract = availability.data?.canExtract ?? false;
  const canReadInstagram = availability.data?.canReadInstagram ?? false;
  const isBusy = read.isPending;

  const submit = () => {
    if (mode === "instagram") {
      if (!url.trim()) return;
      read.mutate({ kind: "instagram", url: url.trim() });
    } else {
      if (!caption.trim()) return;
      read.mutate({ kind: "caption", caption: caption.trim() });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>
                {mode === "instagram" ? "Instagram post" : "Paste the caption"}
              </CardTitle>
              <CardDescription>
                {mode === "instagram"
                  ? "A post or reel URL from the Atmos account. Other accounts need the caption pasted."
                  : "Anything the post says. The poster image can be added at step three."}
              </CardDescription>
            </div>
            <div className="text-muted-foreground flex flex-col items-end gap-1 text-xs">
              <span className="inline-flex items-center gap-1.5">
                <FaInstagram className="size-3.5" aria-hidden />
                {availability.isLoading
                  ? "Checking..."
                  : canReadInstagram
                    ? "Instagram connected"
                    : "Instagram not connected"}
              </span>
              {availability.data?.model ? (
                <span className="font-mono">{availability.data.model}</span>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!availability.isLoading && !canExtract ? (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-300">
              Import is not configured on this environment. Set
              <code className="mx-1 font-mono text-xs">OPENROUTER_API_KEY</code>
              to turn it on.
            </p>
          ) : null}

          {mode === "instagram" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="import-url">Post URL</Label>
              <Input
                id="import-url"
                value={url}
                placeholder="https://www.instagram.com/p/..."
                disabled={isBusy}
                onChange={(event) => setUrl(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") submit();
                }}
              />
              <p className="text-muted-foreground text-xs">
                Post, reel or share links all work.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="import-caption">Caption</Label>
              <Textarea
                id="import-caption"
                rows={10}
                value={caption}
                disabled={isBusy}
                placeholder={
                  "ATMOS PRESENTS NEON CHURCH\nFriday 23 October / Whammy Bar\n10pm til late"
                }
                onChange={(event) => setCaption(event.target.value)}
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={submit}
              disabled={
                isBusy ||
                !canExtract ||
                (mode === "instagram" ? !url.trim() : !caption.trim())
              }
            >
              {isBusy ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Reading the post...
                </>
              ) : (
                <>
                  <Download className="size-4" aria-hidden />
                  Read {mode === "instagram" ? "post" : "caption"}
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              disabled={isBusy}
              onClick={() =>
                setMode(mode === "instagram" ? "caption" : "instagram")
              }
            >
              <ClipboardPaste className="size-4" aria-hidden />
              {mode === "instagram"
                ? "Paste a caption instead"
                : "Use a post URL instead"}
            </Button>
          </div>

          {isBusy ? (
            <p className="text-muted-foreground text-xs">
              Reading the caption and the artwork. This takes a few seconds.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {recent.data && recent.data.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Recent imports</CardTitle>
            <CardDescription>
              The last posts read, and what became of them.
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-border divide-y">
            {recent.data.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {entry.gig?.title ?? "Draft discarded"}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {entry.sourceUrl ?? "Pasted caption"}
                  </p>
                </div>
                {entry.gig ? (
                  <GigStatusBadge status={entry.gig.status} startsAt={null} />
                ) : null}
                <span className="text-muted-foreground text-xs">
                  {entry.createdAt.toLocaleDateString("en-NZ", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                {entry.gig ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/gigs/import?import=${entry.id}`}>
                      {entry.gig.status === "DRAFT" ? "Resume" : "Open"}
                    </Link>
                  </Button>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
