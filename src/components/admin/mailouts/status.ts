import type { DataTableBadge } from "~/components/data-table/types";
import type { RouterOutputs } from "~/trpc/react";

type MailoutStatus = RouterOutputs["mailouts"]["list"][number]["status"];

/** How each mailout status reads in a table. */
export const STATUS_BADGE: Record<MailoutStatus, DataTableBadge> = {
  DRAFT: { label: "Draft", variant: "outline" },
  SCHEDULED: { label: "Scheduled", variant: "secondary" },
  SENDING: { label: "Sending", variant: "default" },
  SENT: { label: "Sent", variant: "secondary" },
  CANCELLED: { label: "Cancelled", variant: "outline" },
};
