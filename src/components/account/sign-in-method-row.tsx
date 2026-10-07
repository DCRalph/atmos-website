"use client";

import { formatDate } from "~/lib/date-utils";
import { providerLabel } from "~/lib/sign-in";

/**
 * One way of signing in, as a row in a list. `action` is whatever the caller
 * lets you do about it: unlink, remove, connect, or nothing.
 */
export function SignInMethodRow({
  providerId,
  connectedAt,
  detail,
  action,
}: {
  providerId: string;
  connectedAt?: Date;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="font-medium">{providerLabel(providerId)}</p>
        <p className="text-muted-foreground truncate text-xs">
          {detail ??
            (connectedAt
              ? `${providerId === "credential" ? "Added" : "Connected"} ${formatDate(connectedAt, "short")}`
              : "Not connected")}
        </p>
      </div>
      {action}
    </div>
  );
}
