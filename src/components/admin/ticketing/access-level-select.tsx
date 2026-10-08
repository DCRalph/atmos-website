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
import { useAccessLevels } from "~/hooks/use-access-levels";

/**
 * Pick one of the access levels, listed least to most access.
 *
 * Offers the active levels from the table. A value on an archived level stays
 * selectable so a tier or ticket already on it still shows what it is.
 */
export function AccessLevelSelect({
  id,
  value,
  onValueChange,
  disabled,
  size = "default",
  className,
}: {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  size?: "sm" | "default";
  className?: string;
}) {
  const { active, level } = useAccessLevels();
  const options = active.some((option) => option.code === value)
    ? active
    : [level(value), ...active];

  return (
    <Select value={value} disabled={disabled} onValueChange={onValueChange}>
      <SelectTrigger
        id={id}
        size={size}
        aria-label="Access level"
        className={className}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.code} value={option.code}>
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
