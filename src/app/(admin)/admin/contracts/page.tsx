import Link from "next/link";

import { AdminSection } from "~/components/admin/admin-section";
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
import { formatCueTime, RUN_SHEET_TIMEZONE } from "~/lib/run-sheet/schedule";
import { requireAdmin } from "~/server/auth-session";
import { listContractSources } from "~/server/contracts";

const day = new Intl.DateTimeFormat("en-NZ", {
  timeZone: RUN_SHEET_TIMEZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
});

const contractLink = "text-muted-foreground hover:text-foreground text-xs";

/**
 * Where contracts are generated: one row for every artist in a set on a
 * recent or upcoming gig, and one for every hire request. Each opens the
 * contract filled in from that row, ready to finish and print.
 */
export default async function AdminContractsPage() {
  await requireAdmin();
  const { gigs, rentals } = await listContractSources();

  return (
    <AdminSection
      title="Contracts"
      description="Performer and equipment hire agreements, filled in from the line-up and the rental requests."
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
                  <TableHead>Gig</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Set</TableHead>
                  <TableHead>Artist</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {gigs.flatMap((gig) =>
                  gig.scheduleItems.flatMap((item) =>
                    item.artists.map((artist) => (
                      <TableRow key={artist.id}>
                        <TableCell>{gig.title}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {day.format(gig.gigStartTime)}
                        </TableCell>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {item.startsAt ? formatCueTime(item.startsAt) : ""}
                        </TableCell>
                        <TableCell>
                          {artist.artistProfile.displayName}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={`/admin/contracts/performer?set=${artist.id}`}
                            className={contractLink}
                          >
                            Contract →
                          </Link>
                        </TableCell>
                      </TableRow>
                    )),
                  ),
                )}
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
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rentals.map((rental) => (
                  <TableRow key={rental.id}>
                    <TableCell>{rental.userName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {rental.gearPackage?.name ?? "Individual items"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {day.format(rental.startDate)} –{" "}
                      {day.format(rental.endDate)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {rental.status === "APPROVED" ? "Approved" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/admin/contracts/hire?rental=${rental.id}`}
                        className={contractLink}
                      >
                        Contract →
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </div>
    </AdminSection>
  );
}
