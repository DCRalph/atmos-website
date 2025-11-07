"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { DatePicker } from "~/components/ui/date-picker";
import { DateTimePicker } from "~/components/ui/datetime-picker";
import { localDateToUTC, utcDateToLocal, formatDateInUserTimezone, isGigUpcoming } from "~/lib/date-utils";

export function GigsManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [time, setTime] = useState<Date | undefined>(undefined);
  const [gigStartTime, setGigStartTime] = useState<Date | undefined>(undefined);
  const [gigEndTime, setGigEndTime] = useState<Date | undefined>(undefined);
  const [ticketLink, setTicketLink] = useState("");

  const { data: gigs, refetch } = api.gigs.getAll.useQuery();
  const createGig = api.gigs.create.useMutation({
    onSuccess: async () => {
      await refetch();
      setIsOpen(false);
      resetForm();
    },
  });
  const updateGig = api.gigs.update.useMutation({
    onSuccess: async () => {
      await refetch();
      setIsOpen(false);
      resetForm();
    },
  });
  const deleteGig = api.gigs.delete.useMutation({
    onSuccess: async () => {
      await refetch();
    },
  });

  const resetForm = () => {
    setEditingId(null);
    setDate(undefined);
    setTitle("");
    setSubtitle("");
    setTime(undefined);
    setGigStartTime(undefined);
    setGigEndTime(undefined);
    setTicketLink("");
  };

  const handleEdit = (gig: NonNullable<typeof gigs>[0]) => {
    setEditingId(gig.id);
    // Convert UTC dates from DB to local dates for the date pickers
    setDate(utcDateToLocal(gig.date));
    setTitle(gig.title);
    setSubtitle(gig.subtitle);
    setTime(gig.time ? (typeof gig.time === 'string' ? undefined : utcDateToLocal(gig.time)) : undefined);
    setGigStartTime(gig.gigStartTime ? utcDateToLocal(gig.gigStartTime) : undefined);
    setGigEndTime(gig.gigEndTime ? utcDateToLocal(gig.gigEndTime) : undefined);
    setTicketLink(gig.ticketLink ?? "");
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return;

    // Convert dates to UTC for storage
    // For date, convert to UTC at midnight
    const utcDate = localDateToUTC(date);

    // For datetime fields, preserve the time but convert to UTC
    // The Date object already represents the correct moment in time,
    // but we need to ensure it's stored as UTC
    const utcTime = time ? new Date(time.getTime()) : undefined;
    const utcGigStartTime = gigStartTime ? new Date(gigStartTime.getTime()) : undefined;
    const utcGigEndTime = gigEndTime ? new Date(gigEndTime.getTime()) : undefined;

    if (editingId) {
      updateGig.mutate({
        id: editingId,
        date: utcDate,
        title,
        subtitle,
        time: utcTime ?? null,
        gigStartTime: utcGigStartTime ?? null,
        gigEndTime: utcGigEndTime ?? null,
        ticketLink: ticketLink.trim() || null,
      });
    } else {
      createGig.mutate({
        date: utcDate,
        title,
        subtitle,
        time: utcTime,
        gigStartTime: utcGigStartTime,
        gigEndTime: utcGigEndTime,
        ticketLink: ticketLink.trim() || undefined,
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <CardTitle>Gigs</CardTitle>
            <CardDescription>Manage upcoming and past gigs</CardDescription>
          </div>
          <Dialog open={isOpen} onOpenChange={(open) => {
            setIsOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>Add Gig</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit" : "Add"} Gig</DialogTitle>
                <DialogDescription>
                  {editingId ? "Update" : "Create"} a new gig
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="date">Date</Label>
                  <DatePicker
                    date={date}
                    onDateChange={setDate}
                    placeholder="Select a date"
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="subtitle">Subtitle</Label>
                  <Input
                    id="subtitle"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="time">Time (optional)</Label>
                  <DateTimePicker
                    date={time}
                    onDateChange={setTime}
                    placeholder="Select time"
                    showTime={true}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="gigStartTime">Gig Start Time (optional)</Label>
                  <DateTimePicker
                    date={gigStartTime}
                    onDateChange={setGigStartTime}
                    placeholder="Select start time"
                    showTime={true}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="gigEndTime">Gig End Time (optional)</Label>
                  <DateTimePicker
                    date={gigEndTime}
                    onDateChange={setGigEndTime}
                    placeholder="Select end time"
                    showTime={true}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="ticketLink">Ticket Link (optional)</Label>
                  <Input
                    id="ticketLink"
                    type="url"
                    value={ticketLink}
                    onChange={(e) => setTicketLink(e.target.value)}
                    placeholder="Leave empty if no tickets available"
                  />
                </div>
                <Button type="submit" disabled={createGig.isPending || updateGig.isPending}>
                  {editingId ? "Update" : "Create"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
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
                    time: typeof gig.time === 'string' ? null : gig.time,
                  }) ? "Upcoming" : "Past"}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(gig)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this gig?")) {
                          deleteGig.mutate({ id: gig.id });
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

