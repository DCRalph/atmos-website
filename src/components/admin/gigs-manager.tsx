"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { formatDateInUserTimezone, isGigUpcoming } from "~/lib/date-utils";
import Link from "next/link";

export function GigsManager() {
  const [search, setSearch] = useState("");
  const { data: gigs, isLoading } = api.gigs.getAll.useQuery(
    search ? { search } : undefined,
  );

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
        <div className="mb-4">
          <Input
            placeholder="Search by title, subtitle, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Start Time</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Media</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`loading-${i}`}>
                    <TableCell colSpan={5}>
                      <div className="bg-muted h-8 w-full animate-pulse rounded" />
                    </TableCell>
                  </TableRow>
                ))
              : gigs
                  ?.filter((gig) => gig.gigStartTime)
                  .map((gig) => (
                    <TableRow key={gig.id}>
                      <TableCell>
                        {formatDateInUserTimezone(gig.gigStartTime!, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell>{gig.title}</TableCell>
                      <TableCell>
                        {isGigUpcoming({
                          gigStartTime: gig.gigStartTime!,
                          gigEndTime: gig.gigEndTime,
                        })
                          ? "Upcoming"
                          : "Past"}
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
            {!isLoading && gigs?.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-muted-foreground text-center"
                >
                  {search ? "No gigs found" : "No gigs yet"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
