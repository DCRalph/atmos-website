"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  ALL_DOMAINS,
  SITE_LINK_DOMAIN,
  servesMainSite,
} from "~/lib/short-links/domains";
import {
  destinationProblem,
  normaliseSlug,
  slugProblem,
} from "~/lib/short-links/rules";

type ShortLink = RouterOutputs["shortLinks"]["byId"];

/**
 * Create or edit a short link. The same rules the router enforces are run here
 * as you type, so a bad slug is caught before it reaches a poster proof.
 *
 * A link goes on one domain or on all of them, picked from the domain prefix
 * in front of the path. Only links that answer on the main site are kept off
 * its pages' paths; on an extra domain any path goes.
 */
export function LinkForm({
  link,
  onSaved,
  onCancel,
}: {
  /** Absent when creating. */
  link?: ShortLink;
  onSaved?: (saved: { id: string }) => void;
  onCancel?: () => void;
}) {
  const utils = api.useUtils();
  const domains = api.shortLinks.domains.useQuery();

  const [domain, setDomain] = useState(link?.domain ?? SITE_LINK_DOMAIN);
  const [slug, setSlug] = useState(link?.slug ?? "");
  const [destination, setDestination] = useState(link?.destination ?? "");
  const [label, setLabel] = useState(link?.label ?? "");
  const [active, setActive] = useState(link?.active ?? true);

  const handlers = {
    onSuccess: (saved: { id: string }) => {
      toast.success(link ? "Link saved" : "Link created");
      void utils.shortLinks.invalidate();
      onSaved?.(saved);
    },
    onError: (error: { message: string }) => toast.error(error.message),
  };
  const create = api.shortLinks.create.useMutation(handlers);
  const update = api.shortLinks.update.useMutation(handlers);
  const saving = create.isPending || update.isPending;

  const normalised = normaliseSlug(slug);
  const slugError = slug ? slugProblem(normalised, domain) : null;
  const destinationError = destination ? destinationProblem(destination) : null;
  const valid = !!slug && !!destination && !slugError && !destinationError;

  function save() {
    const input = { domain, slug, destination, label, active };
    if (link) update.mutate({ id: link.id, ...input });
    else create.mutate(input);
  }

  return (
    <form
      className="grid gap-4 rounded-lg border p-5 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) save();
      }}
    >
      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor="link-slug">Path</Label>
        <div className="flex items-center">
          <Select value={domain} onValueChange={setDomain}>
            <SelectTrigger
              aria-label="Domain"
              className="bg-muted dark:bg-muted hover:text-foreground dark:hover:bg-muted/70 text-muted-foreground shrink-0 rounded-r-none border-r-0 font-mono"
            >
              <SelectValue>
                {domain === ALL_DOMAINS ? "any domain" : domain}/
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value={ALL_DOMAINS}>All domains</SelectItem>
              <SelectItem value={SITE_LINK_DOMAIN}>
                {SITE_LINK_DOMAIN}
              </SelectItem>
              {domains.data?.extra.map((extra) => (
                <SelectItem key={extra.id} value={extra.host}>
                  {extra.host}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            id="link-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            onBlur={() => setSlug(normalised)}
            placeholder="my-link"
            className={cn(
              "rounded-l-none font-mono",
              slugError && "border-destructive",
            )}
            autoComplete="off"
          />
        </div>
        {slugError ? (
          <p className="text-destructive text-xs">{slugError}</p>
        ) : (
          <p className="text-muted-foreground text-xs">
            {domain === ALL_DOMAINS
              ? "Answers on every domain, the main site included, so it can't use a path the main site has a page on."
              : servesMainSite(domain)
                ? "Can't use a path the main site already has a page on."
                : "Any path works here, even ones the main site uses."}
          </p>
        )}
      </div>

      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor="link-destination">Goes to</Label>
        <Input
          id="link-destination"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="https://example.com/tickets or /events"
          className={destinationError ? "border-destructive" : ""}
          autoComplete="off"
        />
        {destinationError ? (
          <p className="text-destructive text-xs">{destinationError}</p>
        ) : (
          <p className="text-muted-foreground text-xs">
            Change this any time. Anything already printed follows it.
          </p>
        )}
      </div>

      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor="link-label">Note</Label>
        <Input
          id="link-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="What this link is for"
        />
        <p className="text-muted-foreground text-xs">
          Only shown in the admin.
        </p>
      </div>

      {link && (
        <div className="flex items-center gap-2 md:col-span-2">
          <Switch
            id="link-active"
            checked={active}
            onCheckedChange={setActive}
          />
          <Label htmlFor="link-active" className="font-normal">
            Live. Switched off, the link 404s but keeps its clicks.
          </Label>
        </div>
      )}

      <div className="flex gap-2 md:col-span-2">
        <Button type="submit" disabled={saving || !valid}>
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden /> Saving…
            </>
          ) : link ? (
            "Save"
          ) : (
            "Create link"
          )}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
