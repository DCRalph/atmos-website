"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { formatDate } from "~/lib/date-utils";
import { ALL_SCOPES, type ApiScope } from "~/lib/developer/scopes";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { CreateKeyDialog } from "./create-key-dialog";

/**
 * Every API key: who made it, what it can do, when it was last used, and the
 * switches to pause or delete it. Every superadmin sees every key.
 */

type ApiKeyRow = RouterOutputs["developer"]["keys"][number];

export function ApiKeysPanel() {
  const utils = api.useUtils();
  const keys = api.developer.keys.useQuery();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<ApiKeyRow | null>(null);

  const setEnabled = api.developer.setKeyEnabled.useMutation({
    onSuccess: (key, input) => {
      toast.success(`${input.enabled ? "Enabled" : "Disabled"} ${key.name}`);
      void utils.developer.keys.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const remove = api.developer.deleteKey.useMutation({
    onSuccess: (key) => {
      toast.success(`Deleted ${key.name}`);
      setDeleting(null);
      void utils.developer.keys.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const columns: DataTableColumn<ApiKeyRow>[] = [
    {
      id: "name",
      header: "Name",
      sortable: true,
      accessor: (row) => row.name,
      cell: (row) => (
        <div>
          <p className="font-medium">{row.name}</p>
          <p className="text-muted-foreground font-mono text-xs">
            {row.start}…
          </p>
        </div>
      ),
    },
    {
      id: "scopes",
      header: "Scopes",
      cell: (row) => <ScopeBadges scopes={row.scopes} />,
    },
    {
      id: "created",
      header: "Created",
      sortable: true,
      accessor: (row) => row.createdAt,
      cell: (row) => (
        <div className="text-xs">
          <p>{row.createdBy?.name ?? "Deleted user"}</p>
          <p className="text-muted-foreground tabular-nums">
            {formatDate(row.createdAt)}
          </p>
        </div>
      ),
    },
    {
      id: "lastUsed",
      header: "Last used",
      sortable: true,
      accessor: (row) => row.lastRequest,
      cell: (row) => (
        <span className="text-muted-foreground text-xs tabular-nums">
          {row.lastRequest ? ago(row.lastRequest) : "Never"}
        </span>
      ),
    },
    {
      id: "expires",
      header: "Expires",
      sortable: true,
      accessor: (row) => row.expiresAt,
      cell: (row) => <Expiry at={row.expiresAt} expired={row.expired} />,
    },
    {
      id: "sends",
      header: "Sends",
      align: "right",
      sortable: true,
      accessor: (row) => row.sends,
      cell: (row) =>
        row.sends > 0 ? (
          <Link
            href={`/admin/notifications/history?key=${row.id}`}
            className="text-xs tabular-nums underline-offset-4 hover:underline"
          >
            {row.sends}
          </Link>
        ) : (
          <span className="text-muted-foreground text-xs tabular-nums">0</span>
        ),
    },
    {
      id: "enabled",
      header: "Enabled",
      align: "center",
      cell: (row) => (
        <Switch
          checked={row.enabled}
          aria-label={`${row.enabled ? "Disable" : "Enable"} ${row.name}`}
          disabled={setEnabled.isPending}
          onCheckedChange={(enabled) =>
            setEnabled.mutate({ id: row.id, enabled })
          }
        />
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      hideable: false,
      cell: (row) => (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete ${row.name}`}
          onClick={() => setDeleting(row)}
        >
          <Trash2 className="text-muted-foreground" aria-hidden />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          One key per integration, so any one can be revoked without touching
          the rest.
        </p>
        <Button onClick={() => setCreating(true)}>
          <Plus aria-hidden />
          New key
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={keys.data ?? []}
        getRowId={(row) => row.id}
        isLoading={keys.isLoading}
        storageKey="admin-developer-keys"
        emptyMessage="No API keys yet"
      />

      <CreateKeyDialog open={creating} onOpenChange={setCreating} />

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Anything using it gets a 401 from now on, and it cannot be brought
              back. What it sent stays in the notification history. To stop it
              for a while instead, turn it off.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={remove.isPending}
              onClick={(event) => {
                // Stay open until the delete lands, so a failure is seen.
                event.preventDefault();
                if (deleting) remove.mutate({ id: deleting.id });
              }}
            >
              {remove.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** A key's scopes by their short name, `announce` in the warning colour. */
export function ScopeBadges({ scopes }: { scopes: ApiScope[] }) {
  if (scopes.length === 0) {
    return <span className="text-muted-foreground text-xs">None</span>;
  }
  return (
    <span className="flex flex-wrap gap-1">
      {ALL_SCOPES.filter((entry) => scopes.includes(entry.scope)).map(
        (entry) => (
          <Badge
            key={entry.scope}
            variant="outline"
            title={entry.description}
            className={`font-mono ${entry.dangerous ? "border-amber-500/50 text-amber-500" : ""}`}
          >
            {entry.scope.split(":")[1]}
          </Badge>
        ),
      )}
    </span>
  );
}

function Expiry({ at, expired }: { at: Date | null; expired: boolean }) {
  if (!at) {
    return <span className="text-muted-foreground text-xs">Never</span>;
  }
  return (
    <span
      className={`text-xs tabular-nums ${expired ? "text-amber-500" : "text-muted-foreground"}`}
    >
      {expired ? "Expired" : formatDate(at)}
    </span>
  );
}

function ago(at: Date): string {
  return formatDistanceToNowStrict(at, { addSuffix: true });
}
