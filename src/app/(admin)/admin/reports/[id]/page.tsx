"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Bot, Link2, MessageSquare } from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { AdminSection } from "~/components/admin/admin-section";
import { ReportFrame } from "~/components/admin/reports/report-frame";
import { Button } from "~/components/ui/button";
import { formatDateTime } from "~/lib/date-utils";

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const report = api.reports.byId.useQuery({ id });
  if (report.isPending)
    return (
      <AdminSection
        title="Report"
        backLink={{ href: "/admin/reports", label: "Reports" }}
      >
        <p className="text-muted-foreground text-sm">Loading report…</p>
      </AdminSection>
    );
  if (!report.data)
    return (
      <AdminSection
        title="Report"
        backLink={{ href: "/admin/reports", label: "Reports" }}
      >
        <p role="alert" className="text-destructive text-sm">
          {report.error?.message ?? "Report not found."}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void report.refetch()}
          className="mt-3"
        >
          Try again
        </Button>
      </AdminSection>
    );
  const data = report.data;
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/admin/reports/${data.id}`,
      );
      toast.success("Report link copied");
    } catch {
      toast.error("Could not copy the link.");
    }
  };
  return (
    <AdminSection
      title={data.title}
      backLink={{ href: "/admin/reports", label: "Reports" }}
      actions={
        <Button variant="outline" size="sm" onClick={() => void copyLink()}>
          <Link2 />
          Copy link
        </Button>
      }
    >
      <div className="overflow-hidden rounded-lg border">
        <div className="bg-card text-muted-foreground flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 text-xs">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="flex items-center gap-1.5">
              <Bot className="size-3.5" />
              Created with Will GPT
            </span>
            <span>{data.user?.name ?? "Deleted user"}</span>
            <time dateTime={data.createdAt.toISOString()}>
              {formatDateTime(data.createdAt)}
            </time>
          </div>
          {data.conversationId ? (
            <Link
              href={`/admin/will-gpt/${data.conversationId}`}
              className="text-foreground inline-flex items-center gap-1.5 hover:underline"
            >
              <MessageSquare className="size-3.5" />
              Conversation
            </Link>
          ) : null}
        </div>
        <ReportFrame title={data.title} html={data.html} />
      </div>
    </AdminSection>
  );
}
