"use client";

import { useState } from "react";
import {
  Ban,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Trash2,
  Undo2,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { formatDate, formatDateTime } from "~/lib/date-utils";
import { formatEventDate } from "~/lib/ticketing/dates";
import { accessLevel as accessLevelMeta } from "~/lib/ticketing/access-levels";
import {
  scanResultLabel,
  scanResultTone,
  type ScanResultTone,
} from "~/lib/ticketing/scan-results";
import { denyReasonLabel } from "~/lib/ticketing/deny-reasons";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
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
import { useConfirm } from "~/components/confirm-provider";

type Pass = RouterOutputs["lifetimeTickets"]["list"][number];
type PassDetail = RouterOutputs["lifetimeTickets"]["byId"];

/** Log rows in the admin's own palette; the door's map is for its dark sheets. */
const TONE_TEXT: Record<ScanResultTone, string> = {
  in: "text-emerald-400",
  out: "text-red-400",
  bad: "text-amber-400",
  neutral: "text-muted-foreground",
};

/**
 * Lifetime passes.
 *
 * A pass is one person and a level, valid at every event. It is issued here,
 * emailed from here, and read back from here: the log in a pass's dialog is
 * every scan of every ticket the pass minted at a door, which is the same
 * history the door itself shows on the night.
 */
export function LifetimeTicketsPanel() {
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const passes = api.lifetimeTickets.list.useQuery();

  const columns: DataTableColumn<Pass>[] = [
    {
      id: "number",
      header: "Pass",
      sortable: true,
      accessor: (row) => row.number,
      cell: (row) => (
        <span className="font-mono font-medium">{row.number}</span>
      ),
    },
    {
      id: "holder",
      header: "Holder",
      sortable: true,
      accessor: (row) => row.holderName,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.holderName}</p>
          {row.holderEmail && (
            <p className="text-muted-foreground truncate text-xs">
              {row.holderEmail}
            </p>
          )}
        </div>
      ),
    },
    {
      id: "level",
      header: "Access",
      accessor: (row) => row.accessLevel,
      cell: (row) => <LevelChip code={row.accessLevel} />,
    },
    {
      id: "status",
      header: "Status",
      sortable: true,
      accessor: (row) => row.status,
      cell: (row) =>
        row.status === "ACTIVE" ? (
          <Badge variant="outline">Active</Badge>
        ) : (
          <Badge variant="destructive">Revoked</Badge>
        ),
    },
    {
      id: "used",
      header: "Used",
      type: "number",
      sortable: true,
      accessor: (row) => row.eventsUsedAt,
      cell: (row) =>
        row.eventsUsedAt === 0 ? (
          <span className="text-muted-foreground">Never</span>
        ) : (
          <div className="min-w-0">
            <p className="tabular-nums">
              {row.eventsUsedAt} event{row.eventsUsedAt === 1 ? "" : "s"}
            </p>
            {row.lastUsed && (
              <p className="text-muted-foreground truncate text-xs">
                Last {formatDate(new Date(row.lastUsed.at), "extra-short")} ·{" "}
                {row.lastUsed.event.name}
              </p>
            )}
          </div>
        ),
    },
    {
      id: "createdAt",
      header: "Issued",
      type: "date",
      sortable: true,
      accessor: (row) => row.createdAt,
      cell: (row) => formatDate(new Date(row.createdAt), "short"),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)} disabled={creating}>
          <Plus className="size-4" aria-hidden /> New pass
        </Button>
      </div>

      {creating && (
        <CreateForm
          onDone={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            setOpenId(id);
          }}
        />
      )}

      <DataTable
        columns={columns}
        data={passes.data ?? []}
        getRowId={(row) => row.id}
        isLoading={passes.isPending}
        isFetching={passes.isFetching}
        onRowClick={(row) => setOpenId(row.id)}
        storageKey="admin-lifetime-tickets"
        emptyMessage="No lifetime passes yet."
      />

      <PassDialog id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

/** The level's chip, coloured from the levels table when it is loaded. */
function LevelChip({ code }: { code: string }) {
  const levels = api.accessLevels.list.useQuery({ includeArchived: true });
  const fromTable = levels.data?.find((level) => level.code === code);
  const meta = fromTable ?? accessLevelMeta(code);
  return (
    <span
      className="inline-block px-2 py-0.5 text-xs font-black tracking-[0.12em]"
      style={{ backgroundColor: meta.badgeBg, color: meta.badgeFg }}
      title={meta.label}
    >
      {meta.short}
    </span>
  );
}

/** Levels from the table, so one added in admin is offered here at once. */
function LevelSelect({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string;
  onChange: (code: string) => void;
}) {
  const levels = api.accessLevels.list.useQuery();
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id}>
        <SelectValue placeholder="Access level" />
      </SelectTrigger>
      <SelectContent>
        {(levels.data ?? []).map((level) => (
          <SelectItem key={level.code} value={level.code}>
            {level.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CreateForm({
  onDone,
  onCreated,
}: {
  onDone: () => void;
  onCreated: (id: string) => void;
}) {
  const utils = api.useUtils();
  const [holderName, setHolderName] = useState("");
  const [holderEmail, setHolderEmail] = useState("");
  const [accessLevel, setAccessLevel] = useState("GENERAL");
  const [notes, setNotes] = useState("");
  const [sendEmail, setSendEmail] = useState(true);

  const create = api.lifetimeTickets.create.useMutation({
    onSuccess: (result) => {
      toast.success(
        result.emailedTo
          ? `${result.number} issued and sent to ${result.emailedTo}.`
          : result.emailError
            ? `${result.number} issued, but the email failed: ${result.emailError}`
            : `${result.number} issued.`,
      );
      void utils.lifetimeTickets.list.invalidate();
      onCreated(result.id);
    },
    onError: (error) => toast.error(error.message),
  });

  const canSubmit = holderName.trim().length > 0 && !create.isPending;

  return (
    <form
      className="grid gap-4 rounded-lg border p-5 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        create.mutate({
          holderName: holderName.trim(),
          holderEmail: holderEmail.trim() || undefined,
          accessLevel,
          notes: notes.trim() || undefined,
          sendEmail,
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="lt-name">Holder</Label>
        <Input
          id="lt-name"
          value={holderName}
          onChange={(e) => setHolderName(e.target.value)}
          placeholder="Their full name"
          autoComplete="off"
          maxLength={120}
        />
        <p className="text-muted-foreground text-xs">
          Goes on the pass and every ticket it mints. The door checks it against
          ID.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="lt-email">Email (optional)</Label>
        <Input
          id="lt-email"
          type="email"
          value={holderEmail}
          onChange={(e) => setHolderEmail(e.target.value)}
          placeholder="them@example.com"
          autoComplete="off"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="lt-level">Access</Label>
        <LevelSelect
          id="lt-level"
          value={accessLevel}
          onChange={setAccessLevel}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="lt-notes">Notes (optional)</Label>
        <Input
          id="lt-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Why they have one"
          maxLength={500}
        />
      </div>

      <div className="flex items-center gap-2 md:col-span-2">
        <Switch
          checked={sendEmail}
          onCheckedChange={setSendEmail}
          disabled={!holderEmail.trim()}
        />
        <span className="text-sm">
          Email the pass now
          {!holderEmail.trim() && (
            <span className="text-muted-foreground"> — needs an address</span>
          )}
        </span>
      </div>

      <div className="flex gap-2 md:col-span-2">
        <Button type="submit" disabled={!canSubmit}>
          {create.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden /> Issuing…
            </>
          ) : (
            "Issue pass"
          )}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function PassDialog({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const detail = api.lifetimeTickets.byId.useQuery(
    { id: id ?? "" },
    { enabled: id !== null },
  );

  return (
    <Dialog open={id !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{detail.data?.number ?? "Pass"}</span>
            {detail.data && (
              <>
                <span className="text-muted-foreground font-normal">
                  {detail.data.holderName}
                </span>
                {detail.data.status === "REVOKED" && (
                  <Badge variant="destructive">Revoked</Badge>
                )}
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {detail.data
              ? detail.data.eventsUsedAt === 0
                ? "Never used."
                : `Used at ${detail.data.eventsUsedAt} event${
                    detail.data.eventsUsedAt === 1 ? "" : "s"
                  }.`
              : "Loading this pass."}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {detail.isPending ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Loading…
            </p>
          ) : detail.data ? (
            <PassDetailBody pass={detail.data} onDeleted={onClose} />
          ) : (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Couldn&apos;t load that pass.
            </p>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function PassDetailBody({
  pass,
  onDeleted,
}: {
  pass: PassDetail;
  onDeleted: () => void;
}) {
  const utils = api.useUtils();
  const confirm = useConfirm();

  const refresh = () =>
    Promise.all([
      utils.lifetimeTickets.byId.invalidate({ id: pass.id }),
      utils.lifetimeTickets.list.invalidate(),
    ]);

  const [holderName, setHolderName] = useState(pass.holderName);
  const [holderEmail, setHolderEmail] = useState(pass.holderEmail ?? "");
  const [accessLevel, setAccessLevel] = useState(pass.accessLevel);
  const [notes, setNotes] = useState(pass.notes ?? "");
  const [sendTo, setSendTo] = useState("");
  const [revokeReason, setRevokeReason] = useState("");
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied] = useState(false);

  const dirty =
    holderName.trim() !== pass.holderName ||
    holderEmail.trim() !== (pass.holderEmail ?? "") ||
    accessLevel !== pass.accessLevel ||
    notes.trim() !== (pass.notes ?? "");

  const update = api.lifetimeTickets.update.useMutation({
    onSuccess: async () => {
      toast.success("Saved. The wallet pass will update itself.");
      await refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const send = api.lifetimeTickets.send.useMutation({
    onSuccess: (result) => {
      toast.success(`Sent to ${result.sentTo ?? "the holder"}.`);
      setSendTo("");
    },
    onError: (error) => toast.error(error.message),
  });
  const reissue = api.lifetimeTickets.reissue.useMutation({
    onSuccess: async () => {
      toast.success("New code issued. The old one no longer scans.");
      await refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const revoke = api.lifetimeTickets.revoke.useMutation({
    onSuccess: async () => {
      toast.success("Revoked.");
      setRevoking(false);
      setRevokeReason("");
      await refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const reinstate = api.lifetimeTickets.reinstate.useMutation({
    onSuccess: async () => {
      toast.success("Reinstated.");
      await refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const remove = api.lifetimeTickets.remove.useMutation({
    onSuccess: async () => {
      toast.success("Deleted.");
      await utils.lifetimeTickets.list.invalidate();
      onDeleted();
    },
    onError: (error) => toast.error(error.message),
  });

  const copyLink = async () => {
    await navigator.clipboard.writeText(pass.holderUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const active = pass.status === "ACTIVE";

  return (
    <div className="space-y-6">
      {/* Who and what */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="lt-edit-name">Holder</Label>
          <Input
            id="lt-edit-name"
            value={holderName}
            onChange={(e) => setHolderName(e.target.value)}
            maxLength={120}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lt-edit-email">Email</Label>
          <Input
            id="lt-edit-email"
            type="email"
            value={holderEmail}
            onChange={(e) => setHolderEmail(e.target.value)}
            placeholder="None"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lt-edit-level">Access</Label>
          <LevelSelect
            id="lt-edit-level"
            value={accessLevel}
            onChange={setAccessLevel}
          />
          <p className="text-muted-foreground text-xs">
            Applies from their next event. Nights already on record keep the
            level they were let in on.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lt-edit-notes">Notes</Label>
          <Input
            id="lt-edit-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            placeholder="None"
          />
        </div>
        {dirty && (
          <div className="flex gap-2 md:col-span-2">
            <Button
              size="sm"
              disabled={update.isPending || !holderName.trim()}
              onClick={() =>
                update.mutate({
                  id: pass.id,
                  holderName: holderName.trim(),
                  holderEmail: holderEmail.trim() || null,
                  accessLevel,
                  notes: notes.trim() || null,
                })
              }
            >
              {update.isPending ? "Saving…" : "Save changes"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setHolderName(pass.holderName);
                setHolderEmail(pass.holderEmail ?? "");
                setAccessLevel(pass.accessLevel);
                setNotes(pass.notes ?? "");
              }}
            >
              Discard
            </Button>
          </div>
        )}
      </section>

      {/* Getting it to them */}
      <section className="space-y-3 rounded-lg border p-4">
        <p className="text-sm font-medium">Send</p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="bg-muted min-w-0 flex-1 truncate px-2 py-1.5 font-mono text-xs">
            {pass.holderUrl}
          </code>
          <Button size="sm" variant="outline" onClick={() => void copyLink()}>
            {copied ? (
              <Check className="size-3.5" aria-hidden />
            ) : (
              <Copy className="size-3.5" aria-hidden />
            )}
            {copied ? "Copied" : "Copy link"}
          </Button>
          <Button size="icon-sm" variant="ghost" asChild>
            <a href={pass.holderUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3.5" aria-hidden />
              <span className="sr-only">Open holder page</span>
            </a>
          </Button>
          {pass.appleWalletUrl && (
            <Button size="sm" variant="outline" asChild>
              <a href={pass.appleWalletUrl}>
                <WalletCards className="size-3.5" aria-hidden />
                Download .pkpass
              </a>
            </Button>
          )}
        </div>
        {active && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={send.isPending || !pass.holderEmail}
              onClick={() => send.mutate({ id: pass.id })}
            >
              <Mail className="size-3.5" aria-hidden />
              {send.isPending
                ? "Sending…"
                : pass.holderEmail
                  ? `Email ${pass.holderEmail}`
                  : "No email on the pass"}
            </Button>
            <Input
              type="email"
              value={sendTo}
              onChange={(e) => setSendTo(e.target.value)}
              placeholder="Or another address"
              className="h-8 w-56 text-sm"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={send.isPending || !sendTo.trim()}
              onClick={() => send.mutate({ id: pass.id, email: sendTo.trim() })}
            >
              Send there
            </Button>
          </div>
        )}
      </section>

      {/* The dangerous end */}
      <section className="flex flex-wrap gap-2">
        {active ? (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={reissue.isPending}
              onClick={async () => {
                const ok = await confirm({
                  title: "Reissue the code?",
                  description:
                    "The QR and the link they were sent stop working. A pass already in their wallet updates itself; anyone else holding a screenshot is out.",
                  confirmLabel: "Reissue",
                });
                if (ok) reissue.mutate({ id: pass.id });
              }}
            >
              <RefreshCw className="size-3.5" aria-hidden />
              {reissue.isPending ? "Reissuing…" : "Reissue code"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setRevoking((value) => !value)}
            >
              <Ban className="size-3.5" aria-hidden /> Revoke
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={reinstate.isPending}
            onClick={() => reinstate.mutate({ id: pass.id })}
          >
            <Undo2 className="size-3.5" aria-hidden />
            {reinstate.isPending ? "Reinstating…" : "Reinstate"}
          </Button>
        )}
        {pass.eventsUsedAt === 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={remove.isPending}
            onClick={async () => {
              const ok = await confirm({
                title: `Delete ${pass.number}?`,
                description:
                  "Only possible because it has never been used. The link and any wallet pass stop working.",
                confirmLabel: "Delete",
                variant: "destructive",
              });
              if (ok) remove.mutate({ id: pass.id });
            }}
          >
            <Trash2 className="size-3.5" aria-hidden /> Delete
          </Button>
        )}
      </section>

      {revoking && active && (
        <section className="space-y-2 rounded-lg border border-red-500/40 bg-red-500/5 p-4">
          <Label htmlFor="lt-revoke-reason">Why?</Label>
          <Textarea
            id="lt-revoke-reason"
            value={revokeReason}
            onChange={(e) => setRevokeReason(e.target.value)}
            maxLength={300}
            placeholder="Kept in the activity log"
            className="min-h-16"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={revoke.isPending || !revokeReason.trim()}
              onClick={() =>
                revoke.mutate({ id: pass.id, reason: revokeReason.trim() })
              }
            >
              {revoke.isPending ? "Revoking…" : "Revoke this pass"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setRevoking(false)}
            >
              Cancel
            </Button>
          </div>
        </section>
      )}

      {!active && (
        <p className="text-sm text-red-300">
          Revoked{" "}
          {pass.revokedAt ? formatDateTime(new Date(pass.revokedAt)) : ""}
          {pass.revokeReason ? ` — ${pass.revokeReason}` : ""}
        </p>
      )}

      {/* Where it has been */}
      <section className="space-y-2">
        <p className="text-sm font-medium">Events</p>
        {pass.events.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Not used anywhere yet.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border text-sm">
            {pass.events.map((ticket) => (
              <li
                key={ticket.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
              >
                <span className="min-w-0 truncate font-medium">
                  {ticket.event.name}
                </span>
                <span className="text-muted-foreground flex items-center gap-3 text-xs">
                  <span>
                    {formatEventDate(
                      new Date(ticket.event.startsAt),
                      ticket.event.timezone,
                    )}
                  </span>
                  <LevelChip code={ticket.accessLevel} />
                  <code className="font-mono">{ticket.ticketNumber}</code>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <p className="text-sm font-medium">Scan log</p>
        {pass.log.length === 0 ? (
          <p className="text-muted-foreground text-sm">No scans yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border text-sm">
            {pass.log.map((entry) => (
              <li key={entry.id} className="space-y-0.5 px-3 py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span
                    className={`font-medium ${TONE_TEXT[scanResultTone(entry.result)]}`}
                  >
                    {scanResultLabel(entry.result)}
                    {entry.wasOverride ? " · override" : ""}
                  </span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {formatDateTime(new Date(entry.at))}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs">
                  {entry.event.name}
                  {entry.by ? ` · ${entry.by}` : ""}
                  {entry.device ? ` · ${entry.device}` : ""}
                </p>
                {(entry.reason ?? entry.note) && (
                  <p className="text-xs">
                    {entry.reason ? denyReasonLabel(entry.reason) : ""}
                    {entry.reason && entry.note ? " — " : ""}
                    {entry.note ?? ""}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
