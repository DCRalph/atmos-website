"use client";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { formatDateInUserTimezone, isGigUpcoming } from "~/lib/date-utils";
import Link from "next/link";

export function GigsManager() {
  const { data: gigs } = api.gigs.getAll.useQuery();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <CardTitle>Gigs</CardTitle>
            <CardDescription>Manage upcoming and past gigs</CardDescription>
          </div>
          <Link href="/admin/gigs/new">
            <Button>Create New Gig</Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Media</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gigs?.map((gig) => (
              <TableRow key={gig.id}>
                <TableCell>
                  {formatDateInUserTimezone(gig.date, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </TableCell>
                <TableCell>{gig.title}</TableCell>
                <TableCell>
                  {isGigUpcoming({
                    date: gig.date,
                    gigEndTime: gig.gigEndTime,
                    gigStartTime: gig.gigStartTime,
                  }) ? "Upcoming" : "Past"}
                </TableCell>
                <TableCell>
                  {(gig.media as Array<{ id: string }>)?.length ?? 0}
                </TableCell>
                <TableCell>
                  <Link href={`/admin/gigs/${gig.id}`}>
                    <Button variant="outline" size="sm">
                      Manage
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

