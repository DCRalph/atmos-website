"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { DateTimePicker } from "~/components/ui/datetime-picker";
import Link from "next/link";

export default function NewGigPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [gigStartTime, setGigStartTime] = useState<Date | undefined>(undefined);
  const [gigEndTime, setGigEndTime] = useState<Date | undefined>(undefined);
  const [ticketLink, setTicketLink] = useState("");

  const createGig = api.gigs.create.useMutation({
    onSuccess: (newGig) => {
      router.push(`/admin/gigs/${newGig.id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gigStartTime) return;

    const utcGigStartTime = new Date(gigStartTime.getTime());
    const utcGigEndTime = gigEndTime ? new Date(gigEndTime.getTime()) : undefined;

    createGig.mutate({
      title,
      subtitle,
      description: description.trim() || undefined,
      gigStartTime: utcGigStartTime,
      gigEndTime: utcGigEndTime,
      ticketLink: ticketLink.trim() || undefined,
    });
  };

  return (
    <div className="min-h-dvh bg-background p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <Link href="/admin/gigs" className="text-muted-foreground hover:text-foreground mb-2 inline-block">
            ← Back to Gigs
          </Link>
          <h1 className="text-4xl font-bold text-foreground">Create New Gig</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Gig Details</CardTitle>
            <CardDescription>Enter the information for the new gig</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                <Label htmlFor="description">Description (Markdown)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter a description using Markdown formatting..."
                  rows={8}
                />
                <p className="text-xs text-muted-foreground">
                  Supports Markdown formatting (bold, italic, links, lists, etc.)
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="gigStartTime">Gig Start Time *</Label>
                <DateTimePicker
                  date={gigStartTime}
                  onDateChange={setGigStartTime}
                  placeholder="Select start time"
                  showTime={true}
                  required
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
                  placeholder="https://example.com/tickets"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createGig.isPending}>
                  {createGig.isPending ? "Creating..." : "Create Gig"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/admin/gigs")}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

