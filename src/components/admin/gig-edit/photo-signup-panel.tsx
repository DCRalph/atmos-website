"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Download,
  ExternalLink,
  Info,
  Loader2,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { gigSlug } from "~/lib/gig-url";
import { shortLinkUrl } from "~/lib/short-links/domains";
import { StatTile } from "~/components/admin/ticketing/charts";
import { CopyButton } from "~/components/admin/short-links/copy-button";
import {
  QrDownloadButtons,
  qrHref,
} from "~/components/admin/short-links/qr-downloads";
import { useConfirm } from "~/components/confirm-provider";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

type Data = RouterOutputs["photoSignup"]["forGig"];
type LinkInfo = NonNullable<Data["link"]>;

/** "19%", or a dash before anybody has scanned. */
const rate = (emails: number, people: number) =>
  people ? `${Math.round((emails / people) * 100)}%` : "–";

/**
 * Photo signup for one gig, in its editor: the short link, a named QR code per
 * spot in the venue, scans against emails for each, and the "photos are up"
 * send. Applies immediately, like the media gallery.
 */
export function PhotoSignupPanel({
  gigId,
  gigTitle,
}: {
  gigId: string;
  gigTitle: string;
}) {
  const query = api.photoSignup.forGig.useQuery({ gigId });
  const data = query.data;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Photo signup</CardTitle>
            <CardDescription>
              QR codes around the venue lead to a page that takes emails, and
              everyone gets one email when the photos are up.
            </CardDescription>
          </div>
          <span className="text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium">
            <Info className="h-3.5 w-3.5" />
            Applies immediately — not part of Save
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {!data ? (
          <div className="text-muted-foreground flex items-center gap-2 py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : data.link ? (
          <SignupNumbers gigId={gigId} data={data} link={data.link} />
        ) : (
          <CreateLink gigId={gigId} gigTitle={gigTitle} />
        )}
      </CardContent>
    </Card>
  );
}

/** Before there's a link: pick its address. */
function CreateLink({ gigId, gigTitle }: { gigId: string; gigTitle: string }) {
  const domains = api.shortLinks.domains.useQuery();
  const hosts = domains.data
    ? [domains.data.site, ...domains.data.extra.map((d) => d.host)]
    : [];
  // `||`, not `??`: the select reports "" while its options are loading.
  const [picked, setDomain] = useState("");
  const domain = picked || (hosts[0] ?? "");
  const [slug, setSlug] = useState(`${gigSlug(gigTitle)}-photos`);
  const utils = api.useUtils();

  const create = api.photoSignup.createLink.useMutation({
    onSuccess: () => void utils.photoSignup.forGig.invalidate({ gigId }),
    onError: (error) => toast.error(error.message),
  });

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate({ gigId, domain, slug });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="photo-signup-domain">Domain</Label>
        <Select value={domain} onValueChange={setDomain}>
          <SelectTrigger id="photo-signup-domain" className="w-56 font-mono">
            <SelectValue placeholder="Loading..." />
          </SelectTrigger>
          <SelectContent>
            {hosts.map((host) => (
              <SelectItem key={host} value={host} className="font-mono">
                {host}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="photo-signup-slug">Path</Label>
        <Input
          id="photo-signup-slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="w-72 font-mono"
        />
      </div>
      <Button
        type="submit"
        disabled={!domain || !slug.trim() || create.isPending}
      >
        {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Create signup link
      </Button>
      <p className="text-muted-foreground w-full text-sm">
        This is the address every QR code encodes. Set it before printing; the
        codes break if it changes.
      </p>
    </form>
  );
}

/** Everything once the link exists. */
function SignupNumbers({
  gigId,
  data,
  link,
}: {
  gigId: string;
  data: Data;
  link: LinkInfo;
}) {
  const host = link.hosts[0] ?? "";
  const url = shortLinkUrl(host, link.slug);
  const [name, setName] = useState("");
  const utils = api.useUtils();
  const confirm = useConfirm();
  const refresh = () => void utils.photoSignup.forGig.invalidate({ gigId });

  const addCode = api.shortLinks.createSubLink.useMutation({
    onSuccess: () => {
      setName("");
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const removeCode = api.shortLinks.deleteSubLink.useMutation({
    onSuccess: refresh,
    onError: (error) => toast.error(error.message),
  });
  const send = api.photoSignup.sendPhotos.useMutation({
    onSuccess: ({ sent, failed }) => {
      if (failed) toast.error(`Sent ${sent}, ${failed} failed. Try again.`);
      else toast.success(`Sent to ${sent} ${sent === 1 ? "person" : "people"}`);
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const sendPhotos = async () => {
    const ok = await confirm({
      title: `Email ${data.pending} ${data.pending === 1 ? "person" : "people"}?`,
      description:
        "Each gets one email saying the photos are up, linking to the gallery. Anyone who signs up later can be sent theirs the same way.",
      confirmLabel: "Send",
    });
    if (ok) send.mutate({ gigId });
  };

  const exportCsv = () => {
    const cells = [
      ["Email", "QR code", "Signed up", "Emailed"],
      ...data.signups.map((s) => [
        s.email,
        s.source ?? "",
        s.createdAt.toISOString(),
        s.notifiedAt?.toISOString() ?? "",
      ]),
    ];
    const csv = cells
      .map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const href = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = Object.assign(document.createElement("a"), {
      href,
      download: `photo-signups-${link.slug}.csv`,
    });
    a.click();
    URL.revokeObjectURL(href);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-sm">Every code leads to</p>
          <p className="font-mono text-sm break-all">{url}</p>
          {!link.active ? (
            <p className="text-destructive mt-1 text-sm">
              This link is switched off, so the codes go nowhere.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton value={url} size="sm" />
          <Button variant="outline" size="sm" asChild>
            <a
              href={`/gigs/${gigId}/photo-signup`}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="size-4" aria-hidden /> Open page
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/links/${link.id}`}>Link details</Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!data.signups.length}
            onClick={exportCsv}
          >
            <Download className="size-4" aria-hidden /> Export CSV
          </Button>
          <Button
            size="sm"
            disabled={!data.hasPhotos || !data.pending || send.isPending}
            onClick={() => void sendPhotos()}
          >
            {send.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" aria-hidden />
            )}
            {data.pending
              ? `Email ${data.pending} ${data.pending === 1 ? "signup" : "signups"}`
              : "Email signups"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Scans" value={String(data.totals.scans)} />
        <StatTile label="People" value={String(data.totals.people)} />
        <StatTile label="Emails" value={String(data.totals.emails)} />
        <StatTile
          label="Signup rate"
          value={rate(data.totals.emails, data.totals.people)}
          sub="of people who scanned"
        />
      </div>

      <section className="rounded-lg border">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <h3 className="font-semibold">QR codes</h3>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              addCode.mutate({ linkId: link.id, name });
            }}
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Where it's going, like bar mirror"
              maxLength={48}
              className="w-64"
            />
            <Button type="submit" disabled={!name.trim() || addCode.isPending}>
              <Plus className="size-4" aria-hidden /> Add code
            </Button>
          </form>
        </div>

        {data.rows.length === 0 ? (
          <p className="text-muted-foreground border-t p-4 text-sm">
            No codes yet. Make one for each spot, so you can see which ones
            work.
          </p>
        ) : (
          <div className="overflow-x-auto border-t">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-left">
                <tr className="border-b">
                  <th className="w-14 p-3" />
                  <th className="p-3 font-medium">Name</th>
                  <th className="p-3 text-right font-medium">Scans</th>
                  <th className="p-3 text-right font-medium">People</th>
                  <th className="p-3 text-right font-medium">Emails</th>
                  <th className="p-3 text-right font-medium">Rate</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {data.rows.map((row) => (
                  <tr
                    key={row.subLinkId ?? "none"}
                    className="border-b last:border-0"
                  >
                    <td className="p-3">
                      {row.code ? (
                        // eslint-disable-next-line @next/next/no-img-element -- an admin-only SVG from our own route
                        <img
                          src={qrHref(link.id, host, "svg", row.code)}
                          alt=""
                          className="size-9 rounded-sm bg-white"
                        />
                      ) : null}
                    </td>
                    <td className="p-3">
                      <p
                        className={
                          row.code ? "font-medium" : "text-muted-foreground"
                        }
                      >
                        {row.name}
                      </p>
                      {row.code ? (
                        <p className="text-muted-foreground font-mono text-xs break-all">
                          {shortLinkUrl(host, link.slug, { code: row.code })}
                        </p>
                      ) : null}
                    </td>
                    <td className="p-3 text-right">{row.scans}</td>
                    <td className="p-3 text-right">{row.people}</td>
                    <td className="p-3 text-right">{row.emails}</td>
                    <td className="p-3 text-right">
                      {rate(row.emails, row.people)}
                    </td>
                    <td className="p-3">
                      {row.code && row.subLinkId ? (
                        <div className="flex justify-end gap-2">
                          <QrDownloadButtons
                            linkId={link.id}
                            host={host}
                            code={row.code}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${row.name}`}
                            disabled={removeCode.isPending}
                            onClick={async () => {
                              const ok = await confirm({
                                title: `Delete "${row.name}"?`,
                                description:
                                  "Printed copies keep working, but new scans and signups from them count as no code.",
                                confirmLabel: "Delete",
                                variant: "destructive",
                              });
                              if (ok && row.subLinkId)
                                removeCode.mutate({ id: row.subLinkId });
                            }}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </Button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-muted-foreground text-sm">
        {data.hasPhotos
          ? "Sending emails everyone who hasn't had it yet, once."
          : "Sending unlocks once the gig has photos in its gallery."}
        {data.signups.length - data.pending > 0
          ? ` ${data.signups.length - data.pending} already emailed.`
          : null}
      </p>
    </div>
  );
}
