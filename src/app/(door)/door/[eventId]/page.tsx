"use client";

import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Banknote,
  ChevronDown,
  ScanLine,
  Settings,
  ShieldQuestionMark,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { CameraScanner } from "~/components/door/camera-scanner";
import { CheckPanel } from "~/components/door/check-panel";
import { ScanResultScreen } from "~/components/door/scan-result-screen";
import { playFeedback, unlockAudio } from "~/components/door/feedback";
import { DoorList } from "~/components/door/door-list";
import { RecentScans } from "~/components/door/recent-scans";
import { SellPanel } from "~/components/door/sell-panel";
import { ManualEntryPanel } from "~/components/door/ticket-number-entry";
import { useLocalStorage } from "~/hooks/use-local-storage";

type ScanOutcome = RouterOutputs["door"]["scan"];

const DEVICE_LABEL_KEY = "atmos.door.deviceLabel";

/** Either half of the door: a scanned code, or a ticket number off the list. */
type Lookup =
  | { kind: "token"; token: string }
  | { kind: "ticketNumber"; ticketNumber: string };

type Mode = "scan" | "list" | "sell" | "check" | "settings";

/**
 * The two tabs that aren't part of working a queue.
 *
 * Four things fit across a phone; a fifth and a sixth make every target too
 * narrow to hit in the dark. Scan, List and Sell are what a door does with
 * somebody standing in front of it, so they keep their own buttons. Checking a
 * ticket and naming the device are both things you do when the queue has
 * stopped, and they go behind one tap.
 */
const EXTRA_MODES = [
  {
    value: "check",
    label: "Check a ticket",
    short: "Check",
    hint: "Look one up without admitting anyone",
    icon: ShieldQuestionMark,
  },
  {
    value: "settings",
    label: "Settings",
    short: "Settings",
    hint: "Name this scanner, test the sound",
    icon: Settings,
  },
] as const satisfies readonly {
  value: Mode;
  label: string;
  short: string;
  hint: string;
  icon: React.ElementType;
}[];

/**
 * The scanner.
 *
 * Camera first, everything else out of the way. Manual entry folds out under
 * the camera rather than taking a tab of its own, because it is the same job —
 * getting this person through the door — done when a screen is smashed or a
 * battery is flat.
 */
export default function DoorScannerPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;

  const [deviceLabel, setDeviceLabel] = useLocalStorage(DEVICE_LABEL_KEY);
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);

  const [lastLookup, setLastLookup] = useState<Lookup | null>(null);
  const [mode, setMode] = useState<Mode>("scan");
  // Lives here rather than in the feed, so switching tabs doesn't quietly put
  // it back to your own scans while you were reading the whole door's.
  const [historyMine, setHistoryMine] = useState(true);

  const utils = api.useUtils();

  const summary = api.door.summary.useQuery(
    { eventId },
    { enabled: !!eventId, refetchInterval: 15_000 },
  );

  const scan = api.door.scan.useMutation({
    onSuccess: (result) => {
      setOutcome(result);
      playFeedback(
        result.result === "ADMITTED" ||
          result.result === "OVERRIDE_ADMITTED" ||
          result.result === "REENTRY"
          ? "success"
          : result.result === "DUPLICATE"
            ? "warn"
            : "error",
      );
      void summary.refetch();
      void utils.door.orderTickets.invalidate();
    },
    onError: (error) => {
      playFeedback("error");
      toast.error(error.message);
    },
  });

  const manual = api.door.admitByTicketNumber.useMutation({
    onSuccess: (result) => {
      setOutcome(result);
      playFeedback(
        result.admit
          ? "success"
          : result.result === "DUPLICATE"
            ? "warn"
            : "error",
      );
      void summary.refetch();
      void utils.door.doorList.invalidate();
      void utils.door.orderTickets.invalidate();
    },
    onError: (error) => {
      playFeedback("error");
      toast.error(error.message);
    },
  });

  const deny = api.door.deny.useMutation({
    onSuccess: (result) => {
      setOutcome(result);
      playFeedback("error");
      // A denial can revert an admission, so the headcount moves too.
      void summary.refetch();
      void utils.door.orderTickets.invalidate();
    },
    onError: (error) => {
      playFeedback("error");
      toast.error(error.message);
    },
  });

  const handleScan = useCallback(
    (token: string) => {
      setLastLookup({ kind: "token", token });
      scan.mutate({
        eventId,
        token,
        deviceLabel: deviceLabel || undefined,
      });
    },
    [eventId, deviceLabel, scan],
  );

  const admitByNumber = useCallback(
    (ticketNumber: string, override = false) => {
      setLastLookup({ kind: "ticketNumber", ticketNumber });
      manual.mutate({
        eventId,
        ticketNumber,
        deviceLabel: deviceLabel || undefined,
        override,
      });
    },
    [eventId, deviceLabel, manual],
  );

  // Re-runs whichever lookup produced the result on screen, with the override
  // flag set. Both endpoints funnel into the same scan path server-side.
  const handleOverride = useCallback(() => {
    if (!lastLookup) return;
    if (lastLookup.kind === "token") {
      scan.mutate({
        eventId,
        token: lastLookup.token,
        deviceLabel: deviceLabel || undefined,
        override: true,
      });
      return;
    }
    admitByNumber(lastLookup.ticketNumber, true);
  }, [lastLookup, eventId, deviceLabel, scan, admitByNumber]);

  if (summary.isPending) {
    return (
      <main className="p-5">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="mt-4 aspect-square w-full" />
      </main>
    );
  }

  if (!summary.data) {
    return (
      <main className="p-8 text-center">
        <p className="text-white/60">
          You&apos;re not on the door for this event.
        </p>
        <Link href="/door" className="mt-4 inline-block underline">
          Back
        </Link>
      </main>
    );
  }

  const { event, sold, admitted, notArrived, isManager } = summary.data;

  /**
   * The live feed, built once and dropped into whichever tab is open.
   *
   * One element rather than one per tab: "what just happened, and can I take it
   * back" is the same question on the scanner, the list and the till, and three
   * copies would be three things to keep in step.
   */
  const historyPanel = (
    <RecentScans
      eventId={eventId}
      deviceLabel={deviceLabel}
      admitting={manual.isPending}
      denying={deny.isPending}
      mine={historyMine}
      onMineChange={setHistoryMine}
      onAdmit={(ticketNumber) => admitByNumber(ticketNumber)}
      onDeny={(ticketId, reason, note) =>
        deny.mutate({
          eventId,
          ticketId,
          reason,
          note: note.trim() || undefined,
          deviceLabel: deviceLabel || undefined,
        })
      }
    />
  );

  return (
    <main
      className="mx-auto w-full max-w-lg px-4 pb-[calc(env(safe-area-inset-bottom)+2.5rem)]"
      // The first tap anywhere unlocks audio for the rest of the session.
      onPointerDown={unlockAudio}
    >
      <header className="sticky top-0 z-10 -mx-4 border-b-2 border-white/10 bg-black/95 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link
            href="/door"
            aria-label="Back to events"
            className="text-white/50 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{event.name}</p>
            <p className="text-xs text-white/40">
              {event.venueName ?? "Door"}
              {event.isR18 ? " · R18" : ""}
              {event.reentryAllowed ? " · re-entry ok" : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl leading-none font-bold tabular-nums">
              {admitted}
              <span className="text-sm font-normal text-white/40">/{sold}</span>
            </p>
            <p className="text-xs text-white/40">{notArrived} to come</p>
          </div>
        </div>

        <div
          className="mt-2 h-1 w-full overflow-hidden bg-white/10"
          role="progressbar"
          aria-valuenow={admitted}
          aria-valuemax={sold}
          aria-label="Admitted"
        >
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${sold > 0 ? (admitted / sold) * 100 : 0}%` }}
          />
        </div>
      </header>

      <nav className="mt-4 grid grid-cols-4 gap-2">
        <ModeButton active={mode === "scan"} onClick={() => setMode("scan")}>
          <ScanLine className="size-4 shrink-0" aria-hidden /> Scan
        </ModeButton>
        <ModeButton active={mode === "list"} onClick={() => setMode("list")}>
          <Users className="size-4 shrink-0" aria-hidden /> List
        </ModeButton>
        <ModeButton active={mode === "sell"} onClick={() => setMode("sell")}>
          <Banknote className="size-4 shrink-0" aria-hidden /> Sell
        </ModeButton>
        <MoreMenu mode={mode} onSelect={setMode} />
      </nav>

      <div className="mt-4 space-y-4">
        {/* Above the content everywhere except the scanner, where the camera
            has first claim on the space under the tabs. Below a door list that
            can run to hundreds of rows it would be unreachable, and the whole
            point of it is being one glance away wherever you are. */}
        {(mode === "list" || mode === "sell") && historyPanel}

        {mode === "scan" && (
          <div className="space-y-4">
            {/* Also paused while a scan is in flight: the result isn't on
                screen yet, and a second code entering the frame in that
                window would queue a scan nobody asked for. */}
            <CameraScanner
              onScan={handleScan}
              paused={outcome !== null || scan.isPending}
            />
            <ManualEntryPanel
              pending={manual.isPending}
              submitLabel="Check in"
              pendingLabel="Checking…"
              onSubmit={(ticketNumber) => admitByNumber(ticketNumber)}
            />
            {historyPanel}
          </div>
        )}

        {mode === "list" && (
          <DoorList
            eventId={eventId}
            admitting={manual.isPending}
            denying={deny.isPending}
            onAdmit={(ticketNumber) => admitByNumber(ticketNumber)}
            onDeny={(ticketId, reason, note) =>
              deny.mutate({
                eventId,
                ticketId,
                reason,
                note: note.trim() || undefined,
                deviceLabel: deviceLabel || undefined,
              })
            }
          />
        )}

        {mode === "sell" && (
          <SellPanel
            eventId={eventId}
            deviceLabel={deviceLabel}
            isManager={isManager}
            onSold={() => {
              void summary.refetch();
              void utils.door.doorList.invalidate();
              void utils.door.orderTickets.invalidate();
            }}
          />
        )}

        {mode === "check" && (
          <CheckPanel eventId={eventId} timezone={event.timezone} />
        )}

        {mode === "settings" && (
          <SettingsPanel
            deviceLabel={deviceLabel}
            onDeviceLabelChange={setDeviceLabel}
            isManager={isManager}
            isR18={event.isR18}
            reentryAllowed={event.reentryAllowed}
          />
        )}
      </div>

      {outcome && (
        <ScanResultScreen
          eventId={eventId}
          outcome={outcome}
          canOverride={isManager}
          overriding={scan.isPending || manual.isPending}
          denying={deny.isPending}
          onDismiss={() => setOutcome(null)}
          onOverride={handleOverride}
          onDeny={(reason, note) => {
            if (!outcome.ticket) return;
            deny.mutate({
              eventId,
              ticketId: outcome.ticket.id,
              reason,
              note: note.trim() || undefined,
              deviceLabel: deviceLabel || undefined,
            });
          }}
        />
      )}
    </main>
  );
}

function modeButtonClass(active: boolean): string {
  return `flex h-12 items-center justify-center gap-1.5 border-2 px-1 text-xs font-medium transition-colors sm:text-sm ${
    active
      ? "border-white bg-white text-black"
      : "border-white/15 text-white/60"
  }`;
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className={modeButtonClass(active)}>
      {children}
    </button>
  );
}

/**
 * The fourth button, which is a menu.
 *
 * When one of its modes is open the button wears that mode's name, so the tab
 * row still answers "where am I" at a glance rather than reading "More" while
 * a different screen is up.
 */
function MoreMenu({
  mode,
  onSelect,
}: {
  mode: Mode;
  onSelect: (mode: Mode) => void;
}) {
  const active = EXTRA_MODES.find((entry) => entry.value === mode) ?? null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={modeButtonClass(active !== null)}>
        <span className="min-w-0 truncate">{active?.short ?? "More"}</span>
        <ChevronDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-64 rounded-none border-2 border-white/20 bg-neutral-900 p-0 text-white"
      >
        {EXTRA_MODES.map((entry) => (
          <DropdownMenuItem
            key={entry.value}
            onSelect={() => onSelect(entry.value)}
            className="flex-col items-start gap-0.5 rounded-none px-4 py-3.5 focus:bg-white focus:text-black"
          >
            <span className="flex items-center gap-2 text-base font-semibold">
              <entry.icon className="size-4 text-current" aria-hidden />
              {entry.label}
            </span>
            <span className="pl-6 text-xs opacity-60">{entry.hint}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The things you set once, before the doors open.
 *
 * Out of the way of the queue on purpose: the scanner name is typed at the
 * start of a shift and never again, and a text field that lives under the
 * camera is a text field somebody's thumb finds at the worst moment.
 */
function SettingsPanel({
  deviceLabel,
  onDeviceLabelChange,
  isManager,
  isR18,
  reentryAllowed,
}: {
  deviceLabel: string;
  onDeviceLabelChange: (value: string) => void;
  isManager: boolean;
  isR18: boolean;
  reentryAllowed: boolean;
}) {
  return (
    <div className="space-y-6">
      <label className="block">
        <span className="text-sm font-medium">Scanner name</span>
        <span className="mt-1 block text-xs text-white/40">
          Recorded against every scan this phone takes, and shown to the next
          person who looks the ticket up. &ldquo;Front door&rdquo;, &ldquo;Side
          gate&rdquo;, &ldquo;Sam&apos;s phone&rdquo;.
        </span>
        <Input
          value={deviceLabel}
          onChange={(e) => onDeviceLabelChange(e.target.value)}
          placeholder="Front door"
          maxLength={60}
          className="mt-2 h-12 bg-white/5"
        />
        <span className="mt-1.5 block text-xs text-white/40">
          Kept on this phone until you change it.
        </span>
      </label>

      {/* The failure mode this prevents is a phone that came out of a pocket
          on silent, whose holder then spends an hour not noticing the ones
          that came back red. */}
      <div className="border-t-2 border-white/10 pt-5">
        <p className="text-sm font-medium">Sound and buzz</p>
        <p className="mt-1 text-xs text-white/40">
          Play each one now, before there&apos;s a queue. If you hear nothing,
          the phone is on silent.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <FeedbackTest tone="success">In</FeedbackTest>
          <FeedbackTest tone="warn">Already in</FeedbackTest>
          <FeedbackTest tone="error">No</FeedbackTest>
        </div>
      </div>

      <dl className="space-y-2 border-t-2 border-white/10 pt-5 text-sm">
        <SettingRow label="You are" value={isManager ? "Manager" : "Scanner"} />
        <SettingRow
          label="Overrides"
          value={isManager ? "You can override" : "Ask a manager"}
        />
        <SettingRow
          label="Re-entry"
          value={reentryAllowed ? "Allowed" : "No"}
        />
        <SettingRow label="R18" value={isR18 ? "Check ID" : "No"} />
      </dl>
    </div>
  );
}

function FeedbackTest({
  tone,
  children,
}: {
  tone: "success" | "warn" | "error";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        unlockAudio();
        playFeedback(tone);
      }}
      className="flex h-12 items-center justify-center border-2 border-white/15 px-1 text-sm font-medium text-white/70 transition-colors active:bg-white active:text-black"
    >
      {children}
    </button>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-white/50">{label}</dt>
      <dd className="truncate text-right">{value}</dd>
    </div>
  );
}
