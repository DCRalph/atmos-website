"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { AdminSection } from "~/components/admin/admin-section";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { GigMode } from "~Prisma/browser";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { DateTimePicker } from "~/components/ui/datetime-picker";

export default function NewGigPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [longDescription, setLongDescription] = useState("");
  const [mode, setMode] = useState<GigMode>(GigMode.NORMAL);
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
    const utcGigEndTime = gigEndTime
      ? new Date(gigEndTime.getTime())
      : undefined;

    createGig.mutate({
      title,
      subtitle,
      shortDescription: shortDescription.trim(),
      longDescription: longDescription.trim() || undefined,
      mode,
      gigStartTime: utcGigStartTime,
      gigEndTime: utcGigEndTime,
      ticketLink: ticketLink.trim() || undefined,
    });
  };

  return (
    <AdminSection
      title="Create New Gig"
      backLink={{ href: "/admin/gigs", label: "← Back to Gigs" }}
      maxWidth="max-w-2xl"
    >
      <Card>
        <CardHeader>
          <CardTitle>Gig Details</CardTitle>
          <CardDescription>
            Enter the information for the new gig
          </CardDescription>
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
              <Label htmlFor="shortDescription">Short Description</Label>
              <Textarea
                id="shortDescription"
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="Short summary for cards..."
                rows={3}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="longDescription">Long Description (Markdown)</Label>
              <Textarea
                id="longDescription"
                value={longDescription}
                onChange={(e) => setLongDescription(e.target.value)}
                placeholder="Enter a description using Markdown formatting..."
                rows={8}
              />
              <p className="text-muted-foreground text-xs">
                Supports Markdown formatting (bold, italic, links, lists, etc.)
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Mode</Label>
              <Select
                value={mode}
                onValueChange={(value) => setMode(value as GigMode)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={GigMode.NORMAL}>Normal</SelectItem>
                  <SelectItem value={GigMode.TO_BE_ANNOUNCED}>
                    To Be Announced
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                To Be Announced hides details and shows a blurred poster.
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
    </AdminSection>
  );
}
