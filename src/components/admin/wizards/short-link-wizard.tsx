"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { CopyButton } from "~/components/admin/short-links/copy-button";
import { QrDownloadButtons } from "~/components/admin/short-links/qr-downloads";
import { gigPath, gigSlug } from "~/lib/gig-url";
import {
  ALL_DOMAINS,
  SITE_LINK_DOMAIN,
  servesMainSite,
  shortLinkUrl,
} from "~/lib/short-links/domains";
import {
  destinationProblem,
  normaliseSlug,
  slugProblem,
} from "~/lib/short-links/rules";
import { cn } from "~/lib/utils";
import {
  Choice,
  EventChoiceList,
  Field,
  GigChoiceList,
  Loading,
  SummaryRow,
  type EventChoice,
  type GigChoice,
} from "./parts";
import { useSteps, WizardFooter, WizardShell } from "./shell";

const STEPS = [
  { key: "where", label: "Where it goes" },
  { key: "link", label: "The link" },
  { key: "review", label: "Review" },
] as const;

type Kind = "gig" | "event" | "url";

/** Where the link points, once picked: a page here or somewhere else. */
type Target = { kind: Kind; title: string | null; destination: string };

const gigTarget = (gig: GigChoice): Target => ({
  kind: "gig",
  title: gig.title,
  destination: gigPath(gig),
});

const eventTarget = (event: EventChoice): Target => ({
  kind: "event",
  title: event.title,
  destination: `/events/${event.slug}`,
});

/** A path made from a title, cut to the 64 characters a path may have. */
const suggestedSlug = (title: string | null) =>
  title ? gigSlug(title).slice(0, 64).replace(/-+$/, "") : "";

/**
 * Make a short link: point it at a gig, a ticketed event or any URL, pick
 * the address, and leave with it copied or as a QR code. `?gig=` or
 * `?event=` starts it pointed at that one. Sub links, click stats and
 * domains stay on the Links page.
 */
export function ShortLinkWizard() {
  const params = useSearchParams();
  const gigId = params.get("gig");
  const eventId = params.get("event");
  const gigs = api.wizards.gigChoices.useQuery(undefined, {
    enabled: Boolean(gigId),
  });
  const events = api.wizards.eventChoices.useQuery(undefined, {
    enabled: Boolean(eventId),
  });

  // Wait for the gig or event named in the URL, so the first step can
  // start already answered.
  if ((gigId && gigs.isPending) || (eventId && events.isPending)) {
    return (
      <WizardShell wizard="short-link">
        <Loading />
      </WizardShell>
    );
  }
  const gig = gigs.data?.find((entry) => entry.id === gigId);
  const event = events.data?.find((entry) => entry.id === eventId);
  const start = gig ? gigTarget(gig) : event ? eventTarget(event) : null;
  return <Steps start={start} />;
}

function Steps({ start }: { start: Target | null }) {
  const utils = api.useUtils();
  const steps = useSteps(STEPS, start ? "link" : undefined);
  const domains = api.shortLinks.domains.useQuery();

  const [kind, setKind] = useState<Kind>(start?.kind ?? "gig");
  const [target, setTarget] = useState<Target | null>(start);
  const [url, setUrl] = useState("");
  const [domain, setDomain] = useState<string>(SITE_LINK_DOMAIN);
  const [slug, setSlug] = useState(() => suggestedSlug(start?.title ?? null));
  const [label, setLabel] = useState(start?.title ?? "");
  const [saved, setSaved] = useState<{ id: string; url: string } | null>(null);

  const destination = kind === "url" ? url.trim() : (target?.destination ?? "");
  const destinationError = destination ? destinationProblem(destination) : null;
  const normalised = normaliseSlug(slug);
  const slugError = slugProblem(normalised, domain);
  // A link on every domain is printed on the main one.
  const host = domain === ALL_DOMAINS ? SITE_LINK_DOMAIN : domain;
  const address = shortLinkUrl(host, normalised || "your-link");

  const pick = (next: Target) => {
    setTarget(next);
    setSlug(suggestedSlug(next.title));
    setLabel(next.title ?? "");
    steps.next();
  };

  const create = api.shortLinks.create.useMutation({
    onSuccess: async (link) => {
      setSaved({ id: link.id, url: shortLinkUrl(host, link.slug) });
      toast.success("Link created");
      await utils.shortLinks.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <WizardShell
      wizard="short-link"
      subtitle={target?.title ?? undefined}
      editorHref="/admin/links"
      steps={steps}
      isDirty={Boolean(target) || url.trim() !== ""}
      done={
        saved ? (
          <Card>
            <CardHeader>
              <CardTitle>Your link is live</CardTitle>
              <CardDescription>
                Change where it goes any time on the Links page. Anything
                already printed follows it.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="font-mono text-lg break-all">{saved.url}</p>
              <div className="flex flex-wrap gap-2">
                <CopyButton value={saved.url} label="Copy link" size="sm" />
                <QrDownloadButtons linkId={saved.id} host={host} />
              </div>
              <p className="text-sm">
                <a
                  href={`/admin/links/${saved.id}`}
                  className="underline underline-offset-4"
                >
                  See its clicks
                </a>
              </p>
            </CardContent>
          </Card>
        ) : undefined
      }
    >
      {steps.step === "where" ? (
        <>
          <div
            role="radiogroup"
            aria-label="Where it goes"
            className="mb-4 grid gap-3 sm:grid-cols-3"
          >
            <Choice
              selected={kind === "gig"}
              onSelect={() => setKind("gig")}
              title="A gig"
              detail="Its page on the site"
            />
            <Choice
              selected={kind === "event"}
              onSelect={() => setKind("event")}
              title="A ticketed event"
              detail="Straight to buying tickets"
            />
            <Choice
              selected={kind === "url"}
              onSelect={() => setKind("url")}
              title="Somewhere else"
              detail="Any web address"
            />
          </div>
          {kind === "gig" ? (
            <GigChoiceList onPick={(gig) => pick(gigTarget(gig))} />
          ) : null}
          {kind === "event" ? <EventPicker onPick={pick} /> : null}
          {kind === "url" ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Where should it go?</CardTitle>
                </CardHeader>
                <CardContent>
                  <Field
                    id="link-url"
                    label="Web address"
                    error={destinationError ?? undefined}
                    hint="Paste the whole thing, https and all, or a path on this site like /events."
                  >
                    <Input
                      id="link-url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://"
                      autoComplete="off"
                    />
                  </Field>
                </CardContent>
              </Card>
              <WizardFooter
                onNext={() => {
                  setTarget({ kind: "url", title: null, destination: url });
                  steps.next();
                }}
                disabled={!url.trim() || Boolean(destinationError)}
              />
            </>
          ) : null}
        </>
      ) : null}

      {steps.step === "link" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>The link</CardTitle>
              <CardDescription>
                Short and easy to say out loud works best.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Field
                id="link-slug"
                label="Address"
                error={slug ? (slugError ?? undefined) : undefined}
                hint={
                  domain === ALL_DOMAINS
                    ? "Works on every domain, the main site included."
                    : servesMainSite(domain)
                      ? "Can't use a path the main site already has a page on."
                      : "Any path works on this domain."
                }
              >
                <div className="flex items-center">
                  <Select value={domain} onValueChange={setDomain}>
                    <SelectTrigger
                      aria-label="Domain"
                      className="bg-muted dark:bg-muted text-muted-foreground max-w-[55%] min-w-0 rounded-r-none border-r-0 font-mono"
                    >
                      <SelectValue>
                        {domain === ALL_DOMAINS ? "any domain" : domain}/
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent align="start">
                      <SelectItem value={SITE_LINK_DOMAIN}>
                        {SITE_LINK_DOMAIN}
                      </SelectItem>
                      {domains.data?.extra.map((extra) => (
                        <SelectItem key={extra.id} value={extra.host}>
                          {extra.host}
                        </SelectItem>
                      ))}
                      <SelectItem value={ALL_DOMAINS}>All domains</SelectItem>
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
                      slug && slugError && "border-destructive",
                    )}
                    autoComplete="off"
                  />
                </div>
              </Field>
              <Field
                id="link-label"
                label="Note"
                hint="What it is for. Only shown in the admin."
              >
                <Input
                  id="link-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  maxLength={120}
                />
              </Field>
            </CardContent>
          </Card>
          <WizardFooter
            onBack={steps.back}
            onNext={steps.next}
            disabled={Boolean(slugError)}
            hint={slugError ?? undefined}
          />
        </>
      ) : null}

      {steps.step === "review" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Review</CardTitle>
              <CardDescription>
                Nothing is made until you press Create.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="divide-border divide-y text-sm">
                <SummaryRow
                  label="Link"
                  value={<span className="font-mono">{address}</span>}
                />
                <SummaryRow
                  label="Goes to"
                  value={
                    target?.title ? (
                      <>
                        {target.title}{" "}
                        <span className="text-muted-foreground font-mono text-xs">
                          {destination}
                        </span>
                      </>
                    ) : (
                      <span className="font-mono">{destination}</span>
                    )
                  }
                />
                {label.trim() ? (
                  <SummaryRow label="Note" value={label.trim()} />
                ) : null}
              </dl>
            </CardContent>
          </Card>
          <WizardFooter
            onBack={steps.back}
            label="Create link"
            onNext={() =>
              create.mutate({
                domain,
                slug: normalised,
                destination,
                label,
                active: true,
              })
            }
            disabled={Boolean(slugError) || !destination}
            isPending={create.isPending}
          />
        </>
      ) : null}
    </WizardShell>
  );
}

/** The event list, handing back the whole row so its slug is known. */
function EventPicker({ onPick }: { onPick: (target: Target) => void }) {
  const events = api.wizards.eventChoices.useQuery();
  return (
    <EventChoiceList
      onPick={(id) => {
        const event = events.data?.find((entry) => entry.id === id);
        if (event) onPick(eventTarget(event));
      }}
    />
  );
}
