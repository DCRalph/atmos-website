import Link from "next/link";

import { AdminSection } from "~/components/admin/admin-section";
import { ContractRowActions } from "~/components/admin/contracts/contract-row-actions";
import { Badge } from "~/components/ui/badge";
import { buttonVariants } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { daysUntil, relativeDay } from "~/lib/contracts";
import { formatCueTime, RUN_SHEET_TIMEZONE } from "~/lib/run-sheet/schedule";
import { cn } from "~/lib/utils";
import { requireAdmin } from "~/server/auth-session";
import { listContractSources } from "~/server/contracts";

const day = new Intl.DateTimeFormat("en-NZ", {
  timeZone: RUN_SHEET_TIMEZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** A gig this close with a contract still unsigned is worth chasing. */
const CHASE_WITHIN_DAYS = 7;

type Sources = Awaited<ReturnType<typeof listContractSources>>;
type Progress = Sources["contracts"][number];

/**
 * How far a contract has got, in one cell: nothing yet, a draft, sent and
 * waiting, or signed, with the date that matters. `urgent` turns an unsigned
 * one amber, for a gig that is nearly here.
 */
function ContractProgress({
  contract,
  urgent = false,
}: {
  contract: Pick<
    Progress,
    "status" | "sentAt" | "sentTo" | "signedAt" | "signedName"
  > | null;
  urgent?: boolean;
}) {
  const waiting = cn(urgent ? "text-amber-500" : "text-muted-foreground");
  if (!contract) return <span className={waiting}>Not started</span>;
  if (contract.status === "SIGNED") {
    return (
      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge>Signed</Badge>
        <span className="text-muted-foreground text-xs">
          {contract.signedAt ? day.format(contract.signedAt) : null}
          {contract.signedName ? "" : " · on paper"}
        </span>
      </span>
    );
  }
  if (contract.status === "SENT") {
    return (
      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge variant="outline">Sent</Badge>
        <span className={cn(waiting, "text-xs")}>
          {contract.sentAt ? `${day.format(contract.sentAt)} · ` : null}
          not signed yet
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <Badge variant="outline">Draft</Badge>
      <span className={cn(waiting, "text-xs")}>not sent</span>
    </span>
  );
}

/** Whether the performer has been paid, from the contract's payment task. */
function Payment({ task }: { task: Progress["paymentTask"] | undefined }) {
  if (!task) return null;
  const label =
    task.status === "DONE"
      ? "Paid"
      : task.status === "CANCELLED"
        ? "Cancelled"
        : `Due ${day.format(task.dueAt)}`;
  return (
    <Link
      href={`/admin/tasks?task=${task.id}`}
      className={cn(
        "text-xs underline-offset-4 hover:underline",
        task.status === "DONE" ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {label}
    </Link>
  );
}

/**
 * Every contract, and whether it is signed before it needs to be.
 *
 * Performers are grouped by gig, soonest first, with how many of the line-up
 * have signed and how close the gig is. A gig within a week that still has
 * someone unsigned is marked. Each row opens its contract, sends it or sends
 * a reminder, and shows whether the performer has been paid. Hire requests
 * get the same. Below them is every saved contract there is, including ones
 * whose gig or rental has since been deleted.
 */
export default async function AdminContractsPage() {
  await requireAdmin();
  const { gigs, rentals, contracts } = await listContractSources();
  const now = new Date();

  return (
    <AdminSection
      title="Contracts"
      description="Performer and equipment hire agreements: who has been sent one, who has signed, and who has been paid."
      actions={
        <>
          <Link
            href="/admin/contracts/performer"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Blank performer agreement
          </Link>
          <Link
            href="/admin/contracts/hire"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Blank hire agreement
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        <section className="rounded-lg border p-4">
          <h2 className="text-muted-foreground mb-2 text-sm font-medium">
            Performers
          </h2>
          {gigs.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No upcoming gig has a line-up yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Set</TableHead>
                  <TableHead>Artist</TableHead>
                  <TableHead>Contract</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {gigs.flatMap((gig) => {
                  const artists = gig.scheduleItems.flatMap((item) =>
                    item.artists.map((artist) => ({ ...artist, item })),
                  );
                  const signed = artists.filter(
                    (artist) => artist.contract?.status === "SIGNED",
                  ).length;
                  const days = daysUntil(gig.gigStartTime, now);
                  const urgent =
                    days >= 0 &&
                    days <= CHASE_WITHIN_DAYS &&
                    signed < artists.length;

                  return [
                    <TableRow key={gig.id} className="hover:bg-transparent">
                      <TableCell colSpan={5} className="pt-5">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                          <span>
                            <span className="font-medium">{gig.title}</span>
                            <span className="text-muted-foreground">
                              {" "}
                              · {day.format(gig.gigStartTime)} ·{" "}
                              {relativeDay(days)}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "text-sm tabular-nums",
                              urgent
                                ? "text-amber-500"
                                : "text-muted-foreground",
                            )}
                          >
                            {signed} of {artists.length} signed
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>,
                    ...artists.map((artist) => (
                      <TableRow key={artist.id}>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {artist.item.startsAt
                            ? formatCueTime(artist.item.startsAt)
                            : ""}
                        </TableCell>
                        <TableCell>
                          {artist.artistProfile.displayName}
                        </TableCell>
                        <TableCell>
                          <ContractProgress
                            contract={artist.contract}
                            urgent={urgent}
                          />
                        </TableCell>
                        <TableCell>
                          <Payment task={artist.contract?.paymentTask} />
                        </TableCell>
                        <TableCell>
                          <ContractRowActions
                            kind="PERFORMER"
                            sourceId={artist.id}
                            contractId={artist.contract?.id ?? null}
                            status={artist.contract?.status ?? null}
                            href={`/admin/contracts/performer?set=${artist.id}`}
                          />
                        </TableCell>
                      </TableRow>
                    )),
                  ];
                })}
              </TableBody>
            </Table>
          )}
        </section>

        <section className="rounded-lg border p-4">
          <h2 className="text-muted-foreground mb-2 text-sm font-medium">
            Equipment hire
          </h2>
          {rentals.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No current hire requests.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hirer</TableHead>
                  <TableHead>Gear</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Request</TableHead>
                  <TableHead>Contract</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rentals.map((rental) => {
                  const days = daysUntil(rental.startDate, now);
                  return (
                    <TableRow key={rental.id}>
                      <TableCell>{rental.userName}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {rental.gearPackage?.name ?? "Individual items"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {day.format(rental.startDate)} –{" "}
                        {day.format(rental.endDate)} · {relativeDay(days)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {rental.status === "APPROVED"
                            ? "Approved"
                            : "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <ContractProgress
                          contract={rental.contract}
                          urgent={
                            days >= 0 &&
                            days <= CHASE_WITHIN_DAYS &&
                            rental.contract?.status !== "SIGNED"
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <ContractRowActions
                          kind="HIRE"
                          sourceId={rental.id}
                          contractId={rental.contract?.id ?? null}
                          status={rental.contract?.status ?? null}
                          href={`/admin/contracts/hire?rental=${rental.id}`}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </section>

        <section className="rounded-lg border p-4">
          <h2 className="text-muted-foreground mb-2 text-sm font-medium">
            All contracts
          </h2>
          {contracts.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nothing saved yet. Open a performer or a hire above to start one.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contract</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>For</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((contract) => {
                  const days = contract.forDate
                    ? daysUntil(contract.forDate, now)
                    : null;
                  return (
                    <TableRow key={contract.id}>
                      <TableCell>{contract.title}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {contract.kind === "PERFORMER"
                          ? "Performer"
                          : "Equipment hire"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {contract.forDate && days !== null
                          ? `${day.format(contract.forDate)} · ${relativeDay(days)}`
                          : "Removed"}
                      </TableCell>
                      <TableCell>
                        <ContractProgress
                          contract={contract}
                          urgent={
                            days !== null &&
                            days >= 0 &&
                            days <= CHASE_WITHIN_DAYS &&
                            contract.status !== "SIGNED"
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Payment task={contract.paymentTask} />
                      </TableCell>
                      <TableCell>
                        <ContractRowActions
                          kind={contract.kind}
                          sourceId={null}
                          contractId={contract.id}
                          status={contract.status}
                          href={`/admin/contracts/${
                            contract.kind === "PERFORMER" ? "performer" : "hire"
                          }?contract=${contract.id}`}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </section>
      </div>
    </AdminSection>
  );
}
