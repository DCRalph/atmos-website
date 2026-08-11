"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { AdminSection } from "~/components/admin/admin-section";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useConfirm } from "~/components/confirm-provider";
import { EventForm } from "~/components/admin/ticketing/event-form";
import { TierManager } from "~/components/admin/ticketing/tier-manager";
import { EventOverview } from "~/components/admin/ticketing/event-overview";
import { OrdersPanel } from "~/components/admin/ticketing/orders-panel";
import { StaffPanel } from "~/components/admin/ticketing/staff-panel";
import { BoxOfficePanel } from "~/components/admin/ticketing/box-office-panel";
import { CompsPanel } from "~/components/admin/ticketing/comps-panel";
import { ShareLinkCard } from "~/components/admin/ticketing/share-link-card";
import { formatEventDateTime } from "~/lib/ticketing/dates";

const STATUSES = [
  "DRAFT",
  "PUBLISHED",
  "SALES_PAUSED",
  "SOLD_OUT",
  "CANCELLED",
  "ARCHIVED",
] as const;

export default function AdminEventPage() {
  const params = useParams<{ id: string }>();
  const utils = api.useUtils();
  const confirm = useConfirm();

  const event = api.ticketEvents.byId.useQuery(
    { id: params.id },
    { enabled: !!params.id },
  );

  const setStatus = api.ticketEvents.setStatus.useMutation({
    onSuccess: () => {
      toast.success("Status updated");
      void utils.ticketEvents.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const approvals = api.ticketAdmin.pendingApprovals.useQuery(
    { eventId: params.id },
    { enabled: !!params.id },
  );

  if (event.isPending) {
    return (
      <div className="p-8">
        <Skeleton className="h-12 w-1/2" />
        <Skeleton className="mt-6 h-96 w-full" />
      </div>
    );
  }
  if (!event.data) {
    return <div className="p-8">Event not found.</div>;
  }

  const data = event.data;

  return (
    <AdminSection
      title={data.name}
      subtitle={`${formatEventDateTime(data.startsAt, data.timezone)}${data.venueName ? ` · ${data.venueName}` : ""}`}
      backLink={{ href: "/admin/events", label: "← Events" }}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{data.tiers.length} tiers</Badge>
          <Select
            value={data.status}
            onValueChange={async (value) => {
              if (value === "CANCELLED") {
                const ok = await confirm({
                  title: "Cancel this event?",
                  description:
                    "Sales stop, the public page says cancelled, and wallet passes are updated. Refunds are not automatic — refund the orders yourself.",
                  confirmLabel: "Cancel event",
                  variant: "destructive",
                });
                if (!ok) return;
              }
              setStatus.mutate({
                id: data.id,
                status: value as (typeof STATUSES)[number],
              });
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status.replace("_", " ").toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" asChild>
            <Link href={`/events/${data.slug}`} target="_blank">
              <ExternalLink className="size-4" /> View
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/admin/events/${data.id}/live`}>Live door</Link>
          </Button>
        </div>
      }
    >
      {approvals.data && approvals.data.length > 0 && (
        <ApprovalQueue eventId={data.id} count={approvals.data.length} />
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tiers">Tiers</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="boxoffice">Box office</TabsTrigger>
          <TabsTrigger value="comps">Comps</TabsTrigger>
          <TabsTrigger value="staff">Door staff</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <ShareLinkCard event={data} />
          <EventOverview eventId={data.id} />
        </TabsContent>
        <TabsContent value="tiers" className="mt-6">
          <TierManager event={data} />
        </TabsContent>
        <TabsContent value="orders" className="mt-6">
          <OrdersPanel eventId={data.id} />
        </TabsContent>
        <TabsContent value="boxoffice" className="mt-6">
          <BoxOfficePanel event={data} />
        </TabsContent>
        <TabsContent value="comps" className="mt-6">
          <CompsPanel event={data} />
        </TabsContent>
        <TabsContent value="staff" className="mt-6">
          <StaffPanel event={data} />
        </TabsContent>
        <TabsContent value="settings" className="mt-6">
          <EventForm event={data} />
        </TabsContent>
      </Tabs>
    </AdminSection>
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
