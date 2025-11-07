"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { DatePicker } from "~/components/ui/date-picker";

export function GigsManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [time, setTime] = useState("");
  const [ticketLink, setTicketLink] = useState("");
  const [isUpcoming, setIsUpcoming] = useState(true);

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
    setTime("");
    setTicketLink("");
    setIsUpcoming(true);
  };

  const handleEdit = (gig: NonNullable<typeof gigs>[0]) => {
    setEditingId(gig.id);
    setDate(gig.date);
    setTitle(gig.title);
    setSubtitle(gig.subtitle);
    setTime(gig.time ?? "");
    setTicketLink(gig.ticketLink ?? "");
    setIsUpcoming(gig.isUpcoming);
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateGig.mutate({
        id: editingId,
        date: date,
        title,
        subtitle,
        time: time || null,
        ticketLink: ticketLink.trim() || null,
        isUpcoming,
      });
    } else {
      if (!date) return;
      createGig.mutate({
        date,
        title,
        subtitle,
        time: time || undefined,
        ticketLink: ticketLink.trim() || undefined,
        isUpcoming,
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
                  <Label htmlFor="time">Time</Label>
                  <Input
                    id="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    placeholder="6:00 PM - 11:00 PM"
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
                <div className="flex flex-col gap-2">
                  <Label htmlFor="isUpcoming">Status</Label>
                  <Select value={isUpcoming ? "upcoming" : "past"} onValueChange={(value) => setIsUpcoming(value === "upcoming")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="past">Past</SelectItem>
                    </SelectContent>
                  </Select>
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
                <TableCell>{gig.date.toLocaleDateString()}</TableCell>
                <TableCell>{gig.title}</TableCell>
                <TableCell>{gig.isUpcoming ? "Upcoming" : "Past"}</TableCell>
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

