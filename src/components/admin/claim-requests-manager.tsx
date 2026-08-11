"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, ExternalLink, Loader2, Search, X } from "lucide-react";
import { api } from "~/trpc/react";
import UserAvatar from "~/components/UserAvatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
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

type StatusFilter = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

type ClaimRequest = {
  id: string;
  status: string;
  message: string | null;
  createdAt: Date | string;
  decidedAt: Date | string | null;
  decidedByAdminId: string | null;
  profile: { id: string; handle: string; displayName: string } | null;
  requestingUser: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
};

function StatusBadge({ status }: { status: string }) {
  if (status === "PENDING") {
    return <Badge variant="outline">Pending</Badge>;
  }
  if (status === "APPROVED") {
    return (
      <Badge variant="default" className="bg-green-600 hover:bg-green-600/90">
        Approved
      </Badge>
    );
  }
  if (status === "REJECTED") {
    return <Badge variant="destructive">Rejected</Badge>;
  }
  return <Badge variant="secondary">{status}</Badge>;
}

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ClaimRequestsManager() {
  const [status, setStatus] = useState<StatusFilter>("PENDING");
  const [search, setSearch] = useState("");
  const [approveTarget, setApproveTarget] = useState<ClaimRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ClaimRequest | null>(null);

  const utils = api.useUtils();
  const list = api.creatorProfiles.listClaimRequests.useQuery({
    status: status === "ALL" ? undefined : status,
  });

  const approve = api.creatorProfiles.approveClaim.useMutation({
    onSuccess: async () => {
      setApproveTarget(null);
      await utils.creatorProfiles.listClaimRequests.invalidate();
      await utils.creatorProfiles.listAll.invalidate();
    },
  });
  const reject = api.creatorProfiles.rejectClaim.useMutation({
    onSuccess: async () => {
      setRejectTarget(null);
      await utils.creatorProfiles.listClaimRequests.invalidate();
      await utils.creatorProfiles.listAll.invalidate();
    },
  });

  const requests = useMemo(() => {
    const all = (list.data ?? []) as ClaimRequest[];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((r) => {
      const hay = [
        r.profile?.handle,
        r.profile?.displayName,
        r.requestingUser?.name,
        r.requestingUser?.email,
        r.message,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [list.data, search]);

  const pendingCount = useMemo(() => {
    if (status === "PENDING") return requests.length;
    return (list.data ?? []).filter((r) => r.status === "PENDING").length;
  }, [list.data, requests, status]);
  const columns: DataTableColumn<ClaimRequest>[] = [
    {
      id: "profile",
      header: "Profile",
      cell: (request) =>
        request.profile ? (
          <div className="flex flex-col">
            <Link
              href={`/admin/creator-profiles/${request.profile.id}`}
              className="text-primary font-mono hover:underline"
            >
              @{request.profile.handle}
            </Link>
            <span className="text-muted-foreground text-xs">
              {request.profile.displayName}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground">(deleted)</span>
        ),
    },
    {
      id: "requester",
      header: "Requested by",
      cell: (request) =>
        request.requestingUser ? (
          <Link
            href={`/admin/users/${request.requestingUser.id}`}
            className="flex items-center gap-2 hover:underline"
          >
            <UserAvatar
              className="h-7 w-7 shrink-0"
              size={14}
              src={request.requestingUser.image}
              name={request.requestingUser.name}
            />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">
                {request.requestingUser.name ?? "Unnamed"}
              </span>
              <span className="text-muted-foreground truncate text-xs">
                {request.requestingUser.email}
              </span>
            </div>
          </Link>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "message",
      header: "Message",
      className: "max-w-sm",
      cell: (request) =>
        request.message ? (
          <p className="line-clamp-3 text-sm whitespace-pre-wrap">
            {request.message}
          </p>
        ) : (
          <span className="text-muted-foreground text-sm italic">
            No message
          </span>
        ),
    },
    {
      id: "status",
      header: "Status",
      cell: (request) => <StatusBadge status={request.status} />,
    },
    {
      id: "requested",
      header: "Requested",
      className: "text-muted-foreground text-xs whitespace-nowrap",
      cell: (request) => formatDate(request.createdAt),
    },
    {
      id: "decided",
      header: "Decided",
      className: "text-muted-foreground text-xs whitespace-nowrap",
      cell: (request) => formatDate(request.decidedAt),
    },
    {
      id: "actions",
      header: "Actions",
      align: "right",
      hideable: false,
      cell: (request) => (
        <div className="flex justify-end gap-1">
          {request.profile && (
            <Button size="sm" variant="ghost" asChild>
              <Link
                href={`/@${request.profile.handle}`}
                target="_blank"
                title="Open profile"
              >
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          )}
          {request.status === "PENDING" && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="text-green-600 hover:text-green-700"
                onClick={() => setApproveTarget(request)}
                title="Approve"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setRejectTarget(request)}
                title="Reject"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              Claim requests
              {pendingCount > 0 && status !== "PENDING" && (
                <Badge variant="outline">{pendingCount} pending</Badge>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-60 flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search handle, user or message…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as StatusFilter)}
            >
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="ALL">All</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DataTable
            columns={columns}
            data={requests}
            getRowId={(row) => row.id}
            isLoading={list.isLoading}
            storageKey="admin-claim-requests"
            emptyMessage={
              status === "PENDING"
                ? "No pending claim requests. Nice and clean."
                : "No claim requests match."
            }
          />
        </CardContent>
      </Card>

      <AlertDialog
        open={Boolean(approveTarget)}
        onOpenChange={(v) => !v && setApproveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Approve claim on @{approveTarget?.profile?.handle}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will link the profile to{" "}
              <b>
                {approveTarget?.requestingUser?.name ??
                  approveTarget?.requestingUser?.email ??
                  "this user"}
              </b>{" "}
              and mark the profile as active. They&apos;ll immediately get edit
              access. Any other pending claims on this profile will be
              automatically rejected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 hover:bg-green-600/90"
              disabled={approve.isPending}
              onClick={() =>
                approveTarget && approve.mutate({ requestId: approveTarget.id })
              }
            >
              {approve.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Approving…
                </>
              ) : (
                "Approve claim"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(rejectTarget)}
        onOpenChange={(v) => !v && setRejectTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Reject claim on @{rejectTarget?.profile?.handle}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The request from{" "}
              <b>
                {rejectTarget?.requestingUser?.name ??
                  rejectTarget?.requestingUser?.email ??
                  "this user"}
              </b>{" "}
              will be marked as rejected. If no other pending claims remain on
              the profile, it will go back to unclaimed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={reject.isPending}
              onClick={() =>
                rejectTarget && reject.mutate({ requestId: rejectTarget.id })
              }
            >
              {reject.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rejecting…
                </>
              ) : (
                "Reject claim"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
