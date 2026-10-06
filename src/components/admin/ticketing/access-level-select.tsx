"use client";

import { toast } from "sonner";

import { api } from "~/trpc/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  ACCESS_LEVELS,
  type AccessLevelValue,
} from "~/lib/ticketing/access-levels";

/** Pick one of the access levels, listed least to most access. */
export function AccessLevelSelect({
  value,
  onValueChange,
  disabled,
  size = "default",
  className,
}: {
  value: string;
  onValueChange: (value: AccessLevelValue) => void;
  disabled?: boolean;
  size?: "sm" | "default";
  className?: string;
}) {
  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        const level = ACCESS_LEVELS.find((option) => option.value === next);
        if (level) onValueChange(level.value);
      }}
    >
      <SelectTrigger
        size={size}
        aria-label="Access level"
        className={className}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ACCESS_LEVELS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** A ticket's level, changed in place from the tickets and orders lists. */
export function TicketAccessLevelSelect({
  ticketId,
  value,
}: {
  ticketId: string;
  value: string;
}) {
  const utils = api.useUtils();
  const setLevel = api.ticketAdmin.setTicketAccessLevel.useMutation({
    onSuccess: () => {
      toast.success("Ticket updated");
      void utils.ticketAdmin.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <AccessLevelSelect
      value={value}
      size="sm"
      className="h-7 text-xs"
      disabled={setLevel.isPending}
      onValueChange={(accessLevel) =>
        setLevel.mutate({ ticketId, accessLevel })
      }
    />
  );
}
