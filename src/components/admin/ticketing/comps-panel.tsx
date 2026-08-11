"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Loader2,
  Mail,
  Minus,
  Plus,
  Send,
  Ticket,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Switch } from "~/components/ui/switch";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  ACCESS_LEVELS,
  type AccessLevelValue,
  accessLevel as accessLevelMeta,
} from "~/lib/ticketing/access-levels";

type AdminEvent = RouterOutputs["ticketEvents"]["byId"];
type Comp = RouterOutputs["ticketAdmin"]["comps"][number];
type Handout = Comp["handouts"][number];

/**
 * Comps — tickets given away by name.
 *
 * Two things this has to get right, and they are the same thing looked at from
 * either end. A comp is *minted*: it comes out of no tier, so an artist can be
 * put on AAA at an event that has never sold an AAA ticket, and the venue cap
 * only ever warns. And a comp is *welded to a person*: the recipient's own
 * ticket carries their name and cannot be renamed, while anything they hand out
 * is a separate ticket with its own link. Handing their own ticket on gains them
 * nothing, because it still turns up at the door in their name.
 */
export function CompsPanel({ event }: { event: AdminEvent }) {
  const utils = api.useUtils();

  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [level, setLevel] = useState<AccessLevelValue>("GUEST");
  const [handoutLevel, setHandoutLevel] = useState<AccessLevelValue>("GENERAL");
  const [handoutCount, setHandoutCount] = useState(0);
  const [notes, setNotes] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [openCompId, setOpenCompId] = useState<string | null>(null);
  const [overage, setOverage] = useState<string | null>(null);

  const comps = api.ticketAdmin.comps.useQuery({ eventId: event.id });
  const accounting = api.ticketAdmin.compAccounting.useQuery({
    eventId: event.id,
  });
  const openComp = comps.data?.find((comp) => comp.id === openCompId);

  const refresh = async () => {
    await Promise.all([
      utils.ticketAdmin.comps.invalidate(),
      utils.ticketAdmin.compAccounting.invalidate(),
      utils.ticketEvents.byId.invalidate(),
      utils.ticketAnalytics.overview.invalidate(),
    ]);
  };

  const issue = api.ticketAdmin.issueComp.useMutation({
    onSuccess: async (result) => {
      toast.success(
        sendEmail && recipientEmail
          ? `Sent to ${recipientEmail}.`
          : `Issued — ${result.hostTicketNumber}.`,
      );
      setRecipientName("");
      setRecipientEmail("");
      setNotes("");
      setHandoutCount(0);
      setOverage(null);
      await refresh();
    },
    onError: (error) => {
      // The cap is a warning, not a wall: show what it would mean and let them
      // send it again having read it.
      if (error.data?.code === "PRECONDITION_FAILED") {
        setOverage(error.message);
        return;
      }
      toast.error(error.message);
    },
  });

  const submit = (acknowledge: boolean) =>
    issue.mutate({
      eventId: event.id,
      recipientName: recipientName.trim(),
      recipientEmail: recipientEmail.trim() || undefined,
      accessLevel: level,
      handouts:
        handoutCount > 0
          ? [{ accessLevel: handoutLevel, quantity: handoutCount }]
          : [],
      notes: notes.trim() || undefined,
      sendEmail,
      acknowledge,
    });

  const canIssue =
    recipientName.trim().length > 0 &&
    (!sendEmail || recipientEmail.trim().length > 0);

  const compColumns: DataTableColumn<Comp>[] = useMemo(
    () => [
      {
        id: "recipient",
        header: "Who",
        accessor: (row) => row.recipientName ?? "",
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate font-medium">
              {row.recipientName ?? "No name"}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {row.recipientEmail ?? "no email"}
            </p>
          </div>
        ),
      },
      {
        id: "level",
        header: "Level",
        accessor: (row) => row.accessLevel,
        cell: (row) => (
          <Badge variant="secondary">
            {accessLevelMeta(row.accessLevel).short}
          </Badge>
        ),
      },
      {
        id: "handouts",
        header: "To hand out",
        accessor: (row) => row.handouts.length,
        cell: (row) =>
          row.handouts.length === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span className="tabular-nums">
              {row.handouts.filter((h) => h.sentAt).length} of{" "}
              {row.handouts.length} sent
            </span>
          ),
      },
      {
        id: "createdAt",
        header: "Issued",
        type: "date",
        accessor: (row) => row.createdAt,
        cell: (row) =>
          new Date(row.createdAt).toLocaleDateString("en-NZ", {
            day: "numeric",
            month: "short",
          }),
      },
      {
        id: "notes",
        header: "Notes",
        cell: (row) => row.notes ?? "—",
      },
    ],
    [],
  );

  return (
    <div className="space-y-8">
      <CompMeter accounting={accounting.data} />

      <section className="space-y-4 rounded-lg border p-5">
        <div>
          <h2 className="text-xl font-semibold">Give someone a ticket</h2>
          <p className="text-muted-foreground text-sm">
            One person, one ticket, in their name — it doesn&apos;t come out of
            a tier, so any level works whether or not you sell it. Add hand-outs
            if they&apos;re bringing people.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="comp-name">Who&apos;s it for</Label>
            <Input
              id="comp-name"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Name on the door"
            />
            <p className="text-muted-foreground text-xs">
              Goes on the ticket and can&apos;t be changed by them — the door
              checks it against ID.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="comp-email">
              Email {sendEmail ? "" : "(optional)"}
            </Label>
            <Input
              id="comp-email"
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="them@example.com"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Their level</Label>
            <LevelSelect value={level} onChange={setLevel} />
          </div>

          <div className="space-y-1.5">
            <Label>Tickets to hand out</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="One fewer hand-out"
                disabled={handoutCount === 0}
                onClick={() => setHandoutCount((n) => Math.max(0, n - 1))}
              >
                <Minus className="size-4" />
              </Button>
              <span className="w-8 text-center tabular-nums">
                {handoutCount}
              </span>
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="One more hand-out"
                disabled={handoutCount >= 20}
                onClick={() => setHandoutCount((n) => n + 1)}
              >
                <Plus className="size-4" />
              </Button>
              {handoutCount > 0 && (
                <div className="flex-1">
                  <LevelSelect
                    value={handoutLevel}
                    onChange={setHandoutLevel}
                  />
                </div>
              )}
            </div>
            <p className="text-muted-foreground text-xs">
              Separate tickets they send on themselves. Fixed at this level —
              they can&apos;t upgrade one.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="comp-notes">Note (optional)</Label>
          <Input
            id="comp-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Why — kept on the order, never shown to them"
          />
        </div>

        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <Switch checked={sendEmail} onCheckedChange={setSendEmail} />
          <span>
            Email it straight away
            <span className="text-muted-foreground block text-xs">
              Off if you&apos;d rather hand it over another way — the link still
              works.
            </span>
          </span>
        </label>

        <Button
          disabled={!canIssue || issue.isPending}
          onClick={() => submit(false)}
        >
          {issue.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Issuing…
            </>
          ) : (
            <>
              <Send className="size-4" />
              {handoutCount > 0
                ? `Comp ${1 + handoutCount} tickets`
                : "Comp a ticket"}
            </>
          )}
        </Button>
      </section>

      <section className="space-y-3">
        <DataTable
          title="Comps issued"
          columns={compColumns}
          data={comps.data ?? []}
          getRowId={(row) => row.id}
          isLoading={comps.isPending}
          isFetching={comps.isFetching}
          onRowClick={(row) => setOpenCompId(row.id)}
          storageKey="admin-ticket-comps"
          emptyMessage="Nothing comped for this event yet."
        />
      </section>

      {/* Over the allowance or the cap. Never a refusal — this is the sentence
          that says what it would mean, and the button that does it anyway. */}
      <Dialog
        open={overage !== null}
        onOpenChange={(open) => !open && setOverage(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" aria-hidden />
              Over the line
            </DialogTitle>
            <DialogDescription>{overage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverage(null)}>
              Cancel
            </Button>
            <Button disabled={issue.isPending} onClick={() => submit(true)}>
              {issue.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Issuing…
                </>
              ) : (
                "Issue anyway"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={openCompId !== null}
        onOpenChange={(open) => !open && setOpenCompId(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{openComp?.recipientName ?? "Comp"}</DialogTitle>
            <DialogDescription>
              {openComp?.ticketNumber}
              {openComp?.notes ? ` · ${openComp.notes}` : ""}
            </DialogDescription>
          </DialogHeader>
          {openComp && <CompDetail comp={openComp} onChanged={refresh} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LevelSelect({
  value,
  onChange,
}: {
  value: AccessLevelValue;
  onChange: (value: AccessLevelValue) => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as AccessLevelValue)}
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ACCESS_LEVELS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * The one place the comp numbers are read from, so the meter, the warning and
 * the analytics tile can never tell three different stories.
 */
function CompMeter({
  accounting,
}: {
  accounting: RouterOutputs["ticketAdmin"]["compAccounting"] | undefined;
}) {
  if (!accounting) return null;

  const {
    allowance,
    issued,
    overAllowanceBy,
    byLevel,
    handouts,
    capacity,
    headcount,
    remainingForSale,
  } = accounting;

  const levels = ACCESS_LEVELS.filter((level) => byLevel[level.value]);

  return (
    <section className="grid gap-4 rounded-lg border p-5 sm:grid-cols-3">
      <div>
        <p className="text-muted-foreground text-sm">Comped</p>
        <p className="text-2xl font-semibold tabular-nums">
          {issued}
          {allowance !== null && (
            <span className="text-muted-foreground text-base font-normal">
              {" "}
              / {allowance}
            </span>
          )}
        </p>
        {allowance !== null && (
          <p
            className={`text-xs ${overAllowanceBy > 0 ? "text-amber-600 dark:text-amber-500" : "text-muted-foreground"}`}
          >
            {overAllowanceBy > 0
              ? `${overAllowanceBy} over the allowance`
              : `${allowance - issued} left`}
          </p>
        )}
      </div>

      <div>
        <p className="text-muted-foreground text-sm">In the room</p>
        <p className="text-2xl font-semibold tabular-nums">{headcount}</p>
        <p className="text-muted-foreground text-xs">
          {capacity === null
            ? "no overall cap"
            : remainingForSale === 0
              ? `at the ${capacity} cap`
              : `${remainingForSale} left to sell of ${capacity}`}
        </p>
      </div>

      <div>
        <p className="text-muted-foreground text-sm">Hand-outs</p>
        <p className="text-2xl font-semibold tabular-nums">
          {handouts.sent}
          <span className="text-muted-foreground text-base font-normal">
            {" "}
            / {handouts.total}
          </span>
        </p>
        <p className="text-muted-foreground text-xs">
          {handouts.unsent > 0 ? `${handouts.unsent} not sent yet` : "all sent"}
        </p>
      </div>

      {levels.length > 0 && (
        <div className="flex flex-wrap gap-2 sm:col-span-3">
          {levels.map((level) => (
            <Badge key={level.value} variant="outline">
              {byLevel[level.value]} × {level.short}
            </Badge>
          ))}
        </div>
      )}
    </section>
  );
}

function CompDetail({
  comp,
  onChanged,
}: {
  comp: Comp;
  onChanged: () => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1 rounded-lg border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{accessLevelMeta(comp.accessLevel).short}</Badge>
          <span className="font-medium">{comp.recipientName}</span>
        </div>
        <p className="text-muted-foreground text-xs">
          Their own ticket. The name is locked — only you can change it.
        </p>
        <a
          href={comp.ticketUrl}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground inline-flex items-center gap-1.5 text-sm underline underline-offset-4"
        >
          <Ticket className="size-3.5" aria-hidden />
          Their ticket
        </a>
      </div>

      {comp.handouts.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            Tickets they hand out ({comp.handouts.length})
          </p>
          <ul className="space-y-2">
            {comp.handouts.map((handout) => (
              <HandoutRow
                key={handout.id}
                handout={handout}
                onChanged={onChanged}
              />
            ))}
          </ul>
        </div>
      )}

      {!comp.recipientEmail && (
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Mail className="size-3.5" aria-hidden />
          No email on this one — send them the link above.
        </p>
      )}
    </div>
  );
}

function HandoutRow({
  handout,
  onChanged,
}: {
  handout: Handout;
  onChanged: () => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);

  const reassign = api.ticketAdmin.reassignHandout.useMutation({
    onSuccess: async () => {
      toast.success("Taken back — the old link no longer works.");
      await onChanged();
    },
    onError: (error) => toast.error(error.message),
  });

  const resend = api.ticketAdmin.resendCompTicket.useMutation({
    onSuccess: () => toast.success("Sent again."),
    onError: (error) => toast.error(error.message),
  });

  const copy = async () => {
    await navigator.clipboard.writeText(handout.ticketUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
      <span className="min-w-0">
        <Badge variant="secondary" className="mr-2">
          {accessLevelMeta(handout.accessLevel).short}
        </Badge>
        {handout.guestName ? (
          <span className="font-medium">{handout.guestName}</span>
        ) : (
          <span className="text-muted-foreground">Not sent yet</span>
        )}
        {handout.admittedAt && (
          <span className="text-muted-foreground ml-2 text-xs">
            arrived{" "}
            {new Date(handout.admittedAt).toLocaleTimeString("en-NZ", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        )}
      </span>

      <span className="flex shrink-0 items-center gap-1">
        <Button size="sm" variant="ghost" onClick={copy}>
          {copied ? (
            <Check className="size-3.5" />
          ) : (
            <Copy className="size-3.5" />
          )}
          Link
        </Button>
        {handout.guestEmail && (
          <Button
            size="sm"
            variant="ghost"
            disabled={resend.isPending}
            onClick={() => resend.mutate({ ticketId: handout.id })}
          >
            <Mail className="size-3.5" /> Resend
          </Button>
        )}
        {/* Gone once they're inside: somebody has walked in on this ticket, and
            renaming it now would rewrite who that was. */}
        {handout.sentAt && !handout.admittedAt && (
          <Button
            size="sm"
            variant="ghost"
            disabled={reassign.isPending}
            onClick={() => reassign.mutate({ ticketId: handout.id })}
          >
            <Undo2 className="size-3.5" /> Take back
          </Button>
        )}
      </span>
    </li>
  );
}
