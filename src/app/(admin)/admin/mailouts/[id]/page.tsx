"use client";

import { useParams } from "next/navigation";

import { api } from "~/trpc/react";
import { AdminSection } from "~/components/admin/admin-section";
import { MailoutEditor } from "~/components/admin/mailouts/mailout-editor";
import { MailoutResults } from "~/components/admin/mailouts/mailout-results";

/** A draft is edited here; once it is scheduled or sent, this is its results. */
export default function MailoutPage() {
  const { id } = useParams<{ id: string }>();
  const mailout = api.mailouts.get.useQuery(
    { id },
    {
      // Live progress while it sends, and the flip from scheduled to sending.
      refetchInterval: (query) =>
        query.state.data?.status === "SENDING" ||
        query.state.data?.status === "SCHEDULED"
          ? 3000
          : false,
    },
  );
  const data = mailout.data;

  return (
    <AdminSection
      title={data?.subject.length ? data.subject : "New mailout"}
      backLink={{ href: "/admin/mailouts", label: "Mailouts" }}
    >
      {mailout.error ? (
        <p className="text-muted-foreground text-sm">{mailout.error.message}</p>
      ) : !data ? (
        <p className="text-muted-foreground text-sm">Loading</p>
      ) : data.status === "DRAFT" ? (
        <MailoutEditor key={data.id} mailout={data} />
      ) : (
        <MailoutResults mailout={data} />
      )}
    </AdminSection>
  );
}
