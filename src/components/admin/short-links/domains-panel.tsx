"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useConfirm } from "~/components/confirm-provider";
import { formatDate } from "~/lib/date-utils";
import { hostProblem, normaliseHost } from "~/lib/short-links/domains";

/**
 * The domains links can live on: the main site, which is fixed, and any extra
 * short domains, which are added and removed here.
 */
export function DomainsPanel() {
  const [host, setHost] = useState("");
  const utils = api.useUtils();
  const confirm = useConfirm();
  const domains = api.shortLinks.domains.useQuery();

  const add = api.shortLinks.addDomain.useMutation({
    onSuccess: (created) => {
      toast.success(`${created.host} added`);
      setHost("");
      void utils.shortLinks.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const remove = api.shortLinks.removeDomain.useMutation({
    onSuccess: () => void utils.shortLinks.invalidate(),
    onError: (error) => toast.error(error.message),
  });

  const normalised = normaliseHost(host);
  const problem = host ? hostProblem(normalised) : null;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border p-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono font-medium">{domains.data?.site}</p>
          <Badge variant="secondary">Main site</Badge>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          Links can&apos;t use a path the site already has a page on. Unknown
          paths show the site&apos;s 404.
        </p>
      </section>

      <section className="space-y-4 rounded-lg border p-5">
        <div>
          <h2 className="text-lg font-semibold">Extra domains</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Every path on these is a link, even <code>/admin</code> or{" "}
            <code>/about</code>. Anything without a live link goes to the main
            site&apos;s home page. A domain starts working once its DNS points
            at Vercel and it has been added to the Vercel project.
          </p>
        </div>

        <form
          className="space-y-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            add.mutate({ host });
          }}
        >
          <div className="flex flex-wrap gap-2">
            <Input
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="atms.nz"
              className="max-w-sm font-mono"
              autoComplete="off"
              aria-label="Domain"
            />
            <Button
              type="submit"
              disabled={!host || !!problem || add.isPending}
            >
              <Plus className="size-4" aria-hidden /> Add domain
            </Button>
          </div>
          {problem && <p className="text-destructive text-xs">{problem}</p>}
        </form>

        {domains.data?.extra.length === 0 ? (
          <p className="text-muted-foreground text-sm">No extra domains yet.</p>
        ) : (
          <ul className="divide-y">
            {domains.data?.extra.map((domain) => (
              <li
                key={domain.id}
                className="flex flex-wrap items-center gap-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-mono font-medium">{domain.host}</p>
                  <p className="text-muted-foreground text-xs">
                    Added {formatDate(domain.createdAt, "short")}
                  </p>
                </div>
                <span className="text-muted-foreground text-sm tabular-nums">
                  {domain.links} {domain.links === 1 ? "link" : "links"}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${domain.host}`}
                  disabled={remove.isPending}
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Remove ${domain.host}?`,
                      description:
                        "Links on all domains stop answering on it. Only a domain with no links of its own can be removed.",
                      confirmLabel: "Remove",
                      variant: "destructive",
                    });
                    if (ok) remove.mutate({ id: domain.id });
                  }}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
