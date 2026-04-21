"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { DateTimePicker } from "~/components/ui/datetime-picker";
import { Loader2 } from "lucide-react";
import { api } from "~/trpc/react";
import { utcDateToLocal } from "~/lib/date-utils";
import {
  SaveStatusPill,
  useSaveStatus,
} from "~/components/admin/gig-edit/save-status";

type DateTimeCardProps = {
  gig: {
    id: string;
    gigStartTime: Date | null;
    gigEndTime: Date | null;
  };
  onSaved: () => Promise<unknown> | void;
  onDirtyChange?: (dirty: boolean) => void;
};

export function DateTimeCard({
  gig,
  onSaved,
  onDirtyChange,
}: DateTimeCardProps) {
  const { status, errorMessage, markDirty, markSaving, markSaved, markError } =
    useSaveStatus({ onDirtyChange });

  const [startTime, setStartTime] = useState<Date | undefined>(
    gig.gigStartTime ? utcDateToLocal(gig.gigStartTime) : undefined,
  );
  const [endTime, setEndTime] = useState<Date | undefined>(
    gig.gigEndTime ? utcDateToLocal(gig.gigEndTime) : undefined,
  );

  useEffect(() => {
    setStartTime(
      gig.gigStartTime ? utcDateToLocal(gig.gigStartTime) : undefined,
    );
    setEndTime(gig.gigEndTime ? utcDateToLocal(gig.gigEndTime) : undefined);
  }, [gig.id, gig.gigStartTime, gig.gigEndTime]);

  const update = api.gigs.update.useMutation({
    onSuccess: async () => {
      await onSaved();
      markSaved();
      toast.success("Date & time saved");
    },
    onError: (err) => {
      markError(err.message);
      toast.error(err.message || "Failed to save date & time");
    },
  });

  const onStartChange = (value: Date | undefined) => {
    setStartTime(value);
    markDirty();
  };

  const onEndChange = (value: Date | undefined) => {
    setEndTime(value);
    markDirty();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startTime) {
      toast.error("Start time is required");
      return;
    }
    if (endTime && endTime < startTime) {
      toast.error("End time cannot be before start time");
      return;
    }
    markSaving();
    update.mutate({
      id: gig.id,
      gigStartTime: new Date(startTime.getTime()),
      gigEndTime: endTime ? new Date(endTime.getTime()) : null,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Date & Time</CardTitle>
            <CardDescription>When the gig starts and ends</CardDescription>
          </div>
          <SaveStatusPill status={status} errorMessage={errorMessage} />
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="gigStartTime">Start *</Label>
            <DateTimePicker
              date={startTime}
              onDateChange={onStartChange}
              placeholder="Select start time"
              showTime
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="gigEndTime">End (optional)</Label>
            <DateTimePicker
              date={endTime}
              onDateChange={onEndChange}
              placeholder="Select end time"
              showTime
            />
          </div>
          <div className="flex items-center justify-end gap-3 border-t pt-4">
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
