"use client";

import { useState } from "react";
import { Ban, Loader2, Search, ShieldOff, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { AdminSection } from "~/components/admin/admin-section";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useConfirm } from "~/components/confirm-provider";
import { useDebouncedValue } from "~/hooks/use-debounced-value";
import { formatDate } from "~/lib/date-utils";
import { denyReasonLabel } from "~/lib/ticketing/deny-reasons";

/**
 * The people the door has checked.
 *
 * Not a browsable directory of the public, and shaped so it cannot become one:
 * with no name typed it shows the ban list and nothing else, because that is
 * the only reason to open this page without somebody in mind.
 *
 * Three jobs live here, all of them things you cannot do on a phone at
 * midnight. Looking up why somebody was barred. Lifting a ban that has done its
 * work. And answering a person who asks what is held about them and to have it
 * deleted — the Privacy Act gives them that right, and a system with no way to
 * honour it is one that cannot be run lawfully.
 */
export default function PatronsPage() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const confirm = useConfirm();
  const utils = api.useUtils();

  const retention = api.patrons.retention.useQuery();
  const results = api.patrons.search.useQuery({
    query: useDebouncedValue(query),
  });

  const purge = api.patrons.purge.useMutation({
    onSuccess: () => {
      toast.success("Record deleted");
      setSelected(null);
      void utils.patrons.search.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <AdminSection
      title="ID checks"
      subtitle="People the door has checked, and everyone currently barred"
      description={
        retention.data
          ? `Records are deleted ${retention.data.days} days after the last check, unless a ban is standing against them.`
          : undefined
      }
      maxWidth="max-w-4xl"
    >
      <div className="space-y-6">
        <div className="relative">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name"
            className="pl-9"
          />
        </div>

        {results.data?.showingBannedOnly && (
          <p className="text-muted-foreground text-sm">
            Showing everyone currently banned. Type a name to search the rest.
          </p>
        )}

        {results.isPending ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Looking…
          </p>
        ) : results.data?.patrons.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {query
              ? `Nobody matching “${query}”.`
              : "Nobody is banned right now."}
          </p>
        ) : (
          <ul className="divide-border divide-y border-y">
            {results.data?.patrons.map((patron) => (
              <li key={patron.id}>
                <button
                  type="button"
                  onClick={() =>
                    setSelected(selected === patron.id ? null : patron.id)
                  }
                  className="hover:bg-muted/50 flex w-full items-center gap-3 px-1 py-3 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-semibold">
                      {patron.fullName}
                      {patron.ban && (
                        <Badge variant="destructive" className="gap-1">
                          <Ban className="size-3" aria-hidden />
                          {denyReasonLabel(patron.ban.reason)}
                        </Badge>
                      )}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      Born {patron.dateOfBirth.toISOString().slice(0, 10)} ·
                      checked {patron.checkCount}×
                    </p>
                  </div>
                </button>

                {selected === patron.id && (
                  <PatronDetail
                    patronId={patron.id}
                    purging={purge.isPending}
                    onPurge={async () => {
                      const ok = await confirm({
                        title: `Delete everything about ${patron.fullName}?`,
                        description:
                          "The name, date of birth, document number and photo go, along with any ban standing against them — a later check will read as a first-time visit. The count of checks this door ran survives; the identity in it does not. This cannot be undone.",
                        confirmLabel: "Delete the record",
                        variant: "destructive",
                      });
                      if (ok) purge.mutate({ patronId: patron.id });
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminSection>
  );
}

/** One person's full record, expanded under their row. */
function PatronDetail({
  patronId,
  purging,
  onPurge,
}: {
  patronId: string;
  purging: boolean;
  onPurge: () => void;
}) {
  const utils = api.useUtils();
  const detail = api.patrons.detail.useQuery({ patronId });

  const lift = api.patrons.liftBan.useMutation({
    onSuccess: () => {
      toast.success("Ban lifted");
      void utils.patrons.detail.invalidate({ patronId });
      void utils.patrons.search.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  if (detail.isPending) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 px-1 pb-4 text-sm">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading…
      </p>
    );
  }
  if (!detail.data) return null;

  const person = detail.data;

  return (
    <div className="bg-muted/30 mb-4 space-y-5 border p-4">
      <div className="flex flex-wrap gap-5">
        {person.photoPath && (
          // The portrait is served by a route that re-checks door access on
          // every request and forbids caching, so it cannot go through the
          // image optimiser — and should not be cached at an edge regardless.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={person.photoPath}
            alt={`Photo from ${person.fullName}'s ID`}
            className="h-40 w-32 border object-cover"
          />
        )}

        <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Field label="Name">{person.fullName}</Field>
          <Field label="Date of birth">{person.dateOfBirth}</Field>
          <Field label="Document">{person.documentLabel}</Field>
          <Field label="Number">{person.documentNumber ?? "—"}</Field>
          <Field label="First seen">
            {formatDate(person.firstSeenAt, "short")}
          </Field>
          <Field label="Last seen">
            {formatDate(person.lastSeenAt, "short")}
          </Field>
          <Field label="Checks">{person.checkCount}</Field>
          <Field label="Deleted on">
            {person.purgeAfter
              ? formatDate(person.purgeAfter, "short")
              : "Held — a ban is standing"}
          </Field>
        </dl>
      </div>

      {person.bans.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-widest uppercase">
            Bans
          </p>
          {person.bans.map((ban) => (
            <div
              key={ban.id}
              className="flex flex-wrap items-start justify-between gap-3 border p-3 text-sm"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-semibold">
                  {denyReasonLabel(ban.reason)}
                  {ban.active ? (
                    <Badge variant="destructive">Active</Badge>
                  ) : (
                    <Badge variant="outline">
                      {ban.liftedAt ? "Lifted" : "Expired"}
                    </Badge>
                  )}
                </p>
                {ban.note && <p className="mt-1">“{ban.note}”</p>}
                <p className="text-muted-foreground mt-1 text-xs">
                  {formatDate(ban.startsAt, "short")}
                  {ban.createdByName ? ` · by ${ban.createdByName}` : ""}
                  {ban.expiresAt
                    ? ` · until ${formatDate(ban.expiresAt, "short")}`
                    : ""}
                  {ban.liftedAt
                    ? ` · lifted ${formatDate(ban.liftedAt, "short")}${ban.liftedByName ? ` by ${ban.liftedByName}` : ""}`
                    : ""}
                </p>
              </div>

              {ban.active && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={lift.isPending}
                  onClick={() => lift.mutate({ banId: ban.id })}
                >
                  <ShieldOff className="size-4" aria-hidden />
                  Lift
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {person.visits.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-widest uppercase">
            Recent checks
          </p>
          <ul className="text-muted-foreground space-y-1 text-sm">
            {person.visits.map((visit, index) => (
              <li key={`${visit.at.toISOString()}-${index}`}>
                {formatDate(visit.at, "short")} · {visit.eventName} ·{" "}
                {visit.result.toLowerCase().replaceAll("_", " ")}
                {visit.deviceLabel ? ` · ${visit.deviceLabel}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t pt-4">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={purging}
          onClick={onPurge}
        >
          <Trash2 className="size-4" aria-hidden />
          Delete this record
        </Button>
        <p className="text-muted-foreground mt-2 text-xs">
          For somebody exercising their right to erasure. Takes any standing ban
          with it.
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs tracking-wide uppercase">
        {label}
      </dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}
