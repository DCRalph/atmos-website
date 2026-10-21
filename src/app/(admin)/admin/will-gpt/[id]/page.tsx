"use client";

import { useParams } from "next/navigation";
import { Check, TriangleAlert } from "lucide-react";

import { api } from "~/trpc/react";
import { AdminSection } from "~/components/admin/admin-section";
import UserAvatar from "~/components/UserAvatar";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import { Transcript } from "~/components/admin/will-gpt/will-gpt-transcript";
import { formatDateTime } from "~/lib/date-utils";
import { WILL_GPT_MODELS } from "~/lib/will-gpt";

/** One Will GPT conversation, read-only, as it happened. */
export default function WillGptConversationPage() {
  const params = useParams<{ id: string }>();
  const conversation = api.willGpt.byId.useQuery({ id: params.id });

  if (conversation.isPending) {
    return (
      <div className="px-4 py-4 sm:px-6 sm:py-5">
        <Skeleton className="h-12 w-1/2" />
        <Skeleton className="mt-6 h-96 w-full max-w-3xl" />
      </div>
    );
  }
  if (conversation.isError) {
    return (
      <div className="space-y-2 px-4 py-4 text-sm sm:px-6 sm:py-5">
        <p role="alert" className="text-destructive">
          Could not load this conversation.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void conversation.refetch()}
        >
          Retry
        </Button>
      </div>
    );
  }
  if (!conversation.data) {
    return (
      <div className="px-4 py-4 sm:px-6 sm:py-5">Conversation not found.</div>
    );
  }

  const data = conversation.data;
  const model =
    WILL_GPT_MODELS.find((option) => option.id === data.model)?.label ??
    data.model;

  return (
    <AdminSection
      title={data.title}
      backLink={{ href: "/admin/will-gpt", label: "Will GPT" }}
      maxWidth="max-w-4xl"
    >
      <div className="text-muted-foreground -mt-2 mb-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span className="text-foreground flex items-center gap-2">
          <UserAvatar
            className="size-6"
            size={12}
            src={data.user?.image}
            name={data.user?.name}
          />
          {data.user?.name ?? "Deleted user"}
        </span>
        <span>{formatDateTime(data.createdAt)}</span>
        <span>{model}</span>
        <span className="flex items-center gap-1.5">
          <Check className="size-3.5 text-emerald-400" />
          {data.changeCount === 1 ? "1 change" : `${data.changeCount} changes`}
        </span>
        {data.awaiting.length > 0 ? (
          <span className="text-destructive flex items-center gap-1.5">
            <TriangleAlert className="size-3.5" />
            Waiting for approval
          </span>
        ) : null}
      </div>
      <div className="flex max-w-3xl flex-col gap-4 text-sm">
        <Transcript messages={data.messages} awaiting={data.awaiting} />
      </div>
    </AdminSection>
  );
}
