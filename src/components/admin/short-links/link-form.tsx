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
  LINK_DOMAIN_VALUES,
  SITE_LINK_DOMAIN,
  isLinkDomain,
  type LinkDomain,
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
 * The domain picker only appears once there is more than one domain to pick.
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

  const [domain, setDomain] = useState<LinkDomain>(
    link && isLinkDomain(link.domain) ? link.domain : SITE_LINK_DOMAIN,
  );
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
      {LINK_DOMAIN_VALUES.length > 1 && (
        <div className="space-y-1.5">
          <Label>Domain</Label>
          <Select
            value={domain}
            onValueChange={(value) => {
              if (isLinkDomain(value)) setDomain(value);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LINK_DOMAIN_VALUES.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="link-slug">Path</Label>
        <div className="flex items-center">
          <span className="text-muted-foreground bg-muted flex h-9 items-center rounded-l-md border border-r-0 px-3 font-mono text-sm">
            {domain}/
          </span>
          <Input
            id="link-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            onBlur={() => setSlug(normalised)}
            placeholder="vol3"
            className={cn(
              "rounded-l-none font-mono",
              slugError && "border-destructive",
            )}
            autoComplete="off"
          />
        </div>
        {slugError && <p className="text-destructive text-xs">{slugError}</p>}
      </div>

      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor="link-destination">Goes to</Label>
        <Input
          id="link-destination"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="https://www.moshtix.co.nz/v2/event/… or /events/vol-3"
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
          placeholder="Vol. 3 tickets, for the poster run"
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
