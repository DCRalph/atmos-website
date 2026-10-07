"use client";

import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { describeUserAgent } from "~/lib/sign-in";

export type SessionRow = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  /** The session making the request, which has no revoke button. */
  isCurrent?: boolean;
};

/**
 * Live sessions for one user. The admin page and the account page share it;
 * only who is allowed to revoke differs, and that is the caller's problem.
 */
export function SessionsTable({
  sessions,
  storageKey,
  onRevoke,
  isRevoking,
}: {
  sessions: SessionRow[];
  storageKey: string;
  onRevoke: (sessionId: string) => void;
  isRevoking: boolean;
}) {
  const columns: DataTableColumn<SessionRow>[] = [
    {
      id: "device",
      header: "Device",
      sortable: true,
      accessor: (row) => describeUserAgent(row.userAgent),
      cell: (row) => (
        <span
          title={row.userAgent ?? undefined}
          className="flex items-center gap-2 font-medium"
        >
          {describeUserAgent(row.userAgent)}
          {row.isCurrent && (
            <Badge variant="secondary" className="text-xs">
              This device
            </Badge>
          )}
        </span>
      ),
    },
    {
      id: "ip",
      header: "IP",
      cell: (row) => (
        <span className="font-mono text-xs">{row.ipAddress ?? "Unknown"}</span>
      ),
    },
    {
      id: "active",
      header: "Last active",
      type: "date",
      sortable: true,
      accessor: (row) => row.updatedAt,
    },
    {
      id: "expires",
      header: "Expires",
      type: "date",
      sortable: true,
      accessor: (row) => row.expiresAt,
    },
    {
      id: "actions",
      header: "",
      align: "right",
      hideable: false,
      cell: (row) =>
        row.isCurrent ? null : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRevoke(row.id)}
            disabled={isRevoking}
          >
            Sign out
          </Button>
        ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={sessions}
      getRowId={(row) => row.id}
      storageKey={storageKey}
      emptyMessage="Not signed in anywhere"
    />
  );
}
