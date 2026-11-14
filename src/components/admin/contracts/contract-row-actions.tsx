"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import type { ContractStatus } from "~Prisma/browser";

import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

/**
 * The actions at the end of a row on the Contracts page: open the contract,
 * and send it without opening it. A draft is sent as it was last saved, and
 * a sent one gets a reminder. A contract that has not been saved yet has to
 * be opened first, and a signed one needs nothing.
 */
export function ContractRowActions({
  kind,
  sourceId,
  contractId,
  status,
  href,
}: {
  kind: "PERFORMER" | "HIRE";
  sourceId: string | null;
  contractId: string | null;
  status: ContractStatus | null;
  href: string;
}) {
  const router = useRouter();
  const send = api.contracts.send.useMutation({
    onSuccess: ({ sentTo, reminder }) => {
      toast.success(`${reminder ? "Reminder sent" : "Sent"} to ${sentTo}`);
      router.refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="flex items-center justify-end gap-3">
      {status === "DRAFT" || status === "SENT" ? (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          disabled={send.isPending}
          onClick={() =>
            send.mutate({ kind, sourceId, contractId, fields: null })
          }
        >
          {send.isPending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Send className="size-3.5" aria-hidden />
          )}
          {status === "SENT" ? "Remind" : "Send"}
        </Button>
      ) : null}
      <Link
        href={href}
        className="text-muted-foreground hover:text-foreground text-xs whitespace-nowrap"
      >
        Open →
      </Link>
    </div>
  );
}
