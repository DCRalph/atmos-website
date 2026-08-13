"use client";

import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";

/**
 * Sending the Tap to Pay on iPhone launch communications.
 *
 * Apple's App Review checklist requires each of these to reach every eligible
 * user at least once — the push is rows 3.3 and 6.3, the email is row 6.1, and
 * the splash (row 6.2) is shown by the app itself the next time each person
 * opens it. Apple asks how coverage was achieved, which is why the counts are
 * on screen rather than only in the database.
 *
 * The send is idempotent: anybody already recorded is skipped, so this can be
 * pressed again after a partial failure without telling anybody twice.
 *
 * ⚠️ The push and email copy is a structurally correct placeholder. Swap it for
 * the approved 'Value Proposition' and 'Launch' wording from the Tap to Pay on
 * iPhone Marketing Guide before sending for real — see
 * `~/server/ticketing/tap-to-pay-launch`.
 */
export function TapToPayLaunchPanel() {
  const status = api.tapToPay.campaignStatus.useQuery();
  const utils = api.useUtils();

  const send = api.tapToPay.sendLaunchCampaign.useMutation({
    onSuccess: (result) => {
      toast.success(
        `Sent — ${result.pushed} pushed, ${result.emailed} emailed of ${result.eligible} eligible.` +
          (result.emailFailures > 0
            ? ` ${result.emailFailures} email(s) failed and will be retried on the next run.`
            : ""),
      );
      void utils.tapToPay.campaignStatus.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  if (status.isPending) return <Skeleton className="h-48 w-full" />;

  const data = status.data;
  if (!data) return null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Tap to Pay launch campaign</h2>
        <p className="text-muted-foreground text-sm">
          Apple requires every eligible staff member to be told about Tap to Pay
          on iPhone at least once, by push and by email. Safe to run more than
          once — anybody already told is skipped.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Eligible staff" value={data.eligible} />
        <Stat label="Pushed" value={data.pushed} total={data.eligible} />
        <Stat label="Emailed" value={data.emailed} total={data.eligible} />
        <Stat
          label="Seen the splash"
          value={data.splashSeen}
          total={data.eligible}
        />
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button
          disabled={send.isPending}
          onClick={() => send.mutate({ push: true, email: true })}
        >
          {send.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : null}
          Send push and email
        </Button>
        <Button
          variant="outline"
          disabled={send.isPending}
          onClick={() => send.mutate({ push: true, email: false })}
        >
          Push only
        </Button>
        <Button
          variant="outline"
          disabled={send.isPending}
          onClick={() => send.mutate({ push: false, email: true })}
        >
          Email only
        </Button>
      </div>

      <p className="text-muted-foreground text-xs">
        The splash screen is shown by the app the next time each person opens
        it, and cannot be sent from here.
      </p>
    </section>
  );
}

function Stat({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total?: number;
}) {
  return (
    <div className="rounded-md border p-3">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums">
        {value}
        {total !== undefined ? (
          <span className="text-muted-foreground text-sm font-normal">
            {" / "}
            {total}
          </span>
        ) : null}
      </dd>
    </div>
  );
}
