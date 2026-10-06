"use client";

import { useParams } from "next/navigation";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { EventWorkspace } from "~/components/admin/ticketing/workspace/event-workspace";

export default function AdminEventPage() {
  const params = useParams<{ id: string }>();

  const event = api.ticketEvents.byId.useQuery(
    { id: params.id },
    { enabled: !!params.id },
  );
  const approvals = api.ticketAdmin.pendingApprovals.useQuery(
    { eventId: params.id },
    { enabled: !!params.id },
  );

  if (event.isPending) {
    return (
      <div className="px-4 py-5 sm:px-6 sm:py-6 lg:p-8">
        <Skeleton className="h-12 w-1/2" />
        <Skeleton className="mt-6 h-96 w-full" />
      </div>
    );
  }
  if (!event.data) {
    return (
      <div className="px-4 py-5 sm:px-6 sm:py-6 lg:p-8">Event not found.</div>
    );
  }

  return (
    <>
      {approvals.data && approvals.data.length > 0 && (
        <div className="mx-auto w-full max-w-7xl px-4 pt-5 sm:px-6 lg:px-8 lg:pt-8">
          <ApprovalQueue eventId={params.id} count={approvals.data.length} />
        </div>
      )}
      <EventWorkspace event={event.data} />
    </>
  );
}

type ApprovalRow = RouterOutputs["ticketAdmin"]["pendingApprovals"][number];

/** Guest-list tiers that need a decision before tickets are issued. */
function ApprovalQueue({ eventId, count }: { eventId: string; count: number }) {
  const utils = api.useUtils();
  const approvals = api.ticketAdmin.pendingApprovals.useQuery({ eventId });

  const decide = api.ticketAdmin.decideApproval.useMutation({
    onSuccess: (result) => {
      toast.success(result.approved ? "Approved and emailed." : "Declined.");
      void utils.ticketAdmin.pendingApprovals.invalidate();
      void utils.ticketEvents.byId.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const columns: DataTableColumn<ApprovalRow>[] = [
    {
      id: "buyer",
      header: "Requested by",
      accessor: (row) => row.buyerName ?? "",
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.buyerName ?? "No name"}</p>
          <p className="text-muted-foreground truncate text-xs">
            {row.buyerEmail}
          </p>
        </div>
      ),
    },
    {
      id: "tickets",
      header: "Tickets",
      cell: (row) =>
        row.items
          .map((item) => `${item.quantity}× ${item.tier.name}`)
          .join(", "),
    },
    {
      id: "actions",
      header: "",
      hideable: false,
      align: "right",
      cell: (row) => (
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            disabled={decide.isPending}
            onClick={() => decide.mutate({ orderId: row.id, approve: true })}
          >
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={decide.isPending}
            onClick={() => decide.mutate({ orderId: row.id, approve: false })}
          >
            Decline
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
      <DataTable
        title={`${count} guest list request${count === 1 ? "" : "s"} waiting`}
        columns={columns}
        data={approvals.data ?? []}
        getRowId={(row) => row.id}
        isLoading={approvals.isPending}
        storageKey="admin-event-approvals"
        emptyMessage="Nothing waiting."
      />
    </div>
  );
}
