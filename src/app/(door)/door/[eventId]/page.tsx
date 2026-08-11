"use client";

import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Keyboard, Users } from "lucide-react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { CameraScanner } from "~/components/door/camera-scanner";
import { ScanResultScreen } from "~/components/door/scan-result-screen";
import { playFeedback, unlockAudio } from "~/components/door/feedback";
import { DoorList } from "~/components/door/door-list";
import { useLocalStorage } from "~/hooks/use-local-storage";

type ScanOutcome = RouterOutputs["door"]["scan"];

const DEVICE_LABEL_KEY = "atmos.door.deviceLabel";

/**
 * The scanner.
 *
 * Camera first, everything else out of the way. Manual entry and the door list
 * are one tap down because they're the fallbacks that save the night when a
 * phone screen is smashed or someone turns up with nothing.
 */
export default function DoorScannerPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;

  // Persisted so a phone that gets locked and reopened mid-shift keeps its
  // identity — every scan is attributed to this label.
  const [deviceLabel, setDeviceLabel] = useLocalStorage(DEVICE_LABEL_KEY);
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [lastToken, setLastToken] = useState<string | null>(null);
  const [mode, setMode] = useState<"scan" | "manual" | "list">("scan");

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
    },
    onError: (error) => {
      playFeedback("error");
      toast.error(error.message);
    },
  });

  const manual = api.door.admitByTicketNumber.useMutation({
    onSuccess: (result) => {
      setOutcome(result);
      playFeedback(result.admit ? "success" : "error");
      void summary.refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const deny = api.door.deny.useMutation({
    onSuccess: (result) => {
      setOutcome(result);
      playFeedback("error");
      // A denial can revert an admission, so the headcount moves too.
      void summary.refetch();
    },
    onError: (error) => {
      playFeedback("error");
      toast.error(error.message);
    },
  });

  const handleScan = useCallback(
    (token: string) => {
      setLastToken(token);
      scan.mutate({
        eventId,
        token,
        deviceLabel: deviceLabel || undefined,
      });
    },
    [eventId, deviceLabel, scan],
  );

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
        <p className="text-white/60">You&apos;re not on the door for this event.</p>
        <Link href="/door" className="mt-4 inline-block underline">
          Back
        </Link>
      </main>
    );
  }

  const { event, sold, admitted, notArrived, isManager } = summary.data;

  return (
    <main
      className="mx-auto w-full max-w-lg px-4 pb-10"
      // The first tap anywhere unlocks audio for the rest of the session.
      onPointerDown={unlockAudio}
    >
      <header className="sticky top-0 z-10 -mx-4 border-b-2 border-white/10 bg-black/95 px-4 py-3 backdrop-blur">
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

      <nav className="mt-4 grid grid-cols-3 gap-2">
        <ModeButton active={mode === "scan"} onClick={() => setMode("scan")}>
          Scan
        </ModeButton>
        <ModeButton active={mode === "manual"} onClick={() => setMode("manual")}>
          <Keyboard className="size-4" aria-hidden /> Manual
        </ModeButton>
        <ModeButton active={mode === "list"} onClick={() => setMode("list")}>
          <Users className="size-4" aria-hidden /> List
        </ModeButton>
      </nav>

      <div className="mt-4">
        {mode === "scan" && (
          <>
            <CameraScanner onScan={handleScan} paused={outcome !== null} />
            <DeviceLabelField value={deviceLabel} onChange={setDeviceLabel} />
          </>
        )}

        {mode === "manual" && (
          <ManualEntry
            pending={manual.isPending}
            onSubmit={(ticketNumber) =>
              manual.mutate({
                eventId,
                ticketNumber,
                deviceLabel: deviceLabel || undefined,
              })
            }
          />
        )}

        {mode === "list" && <DoorList eventId={eventId} />}
      </div>

      {outcome && (
        <ScanResultScreen
          outcome={outcome}
          canOverride={isManager}
          overriding={scan.isPending}
          denying={deny.isPending}
          onDismiss={() => setOutcome(null)}
          onOverride={() => {
            if (!lastToken) return;
            scan.mutate({
              eventId,
              token: lastToken,
              deviceLabel: deviceLabel || undefined,
              override: true,
            });
          }}
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
    <button
      type="button"
      onClick={onClick}
      className={`flex h-12 items-center justify-center gap-1.5 border-2 text-sm font-medium transition-colors ${
        active
          ? "border-white bg-white text-black"
          : "border-white/15 text-white/60"
      }`}
    >
      {children}
    </button>
  );
}

function DeviceLabelField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="mt-4 block">
      <span className="text-xs text-white/40">
        This device — shows on every scan you take
      </span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Front door"
        className="mt-1.5 h-12 bg-white/5"
      />
    </label>
  );
}

function ManualEntry({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (ticketNumber: string) => void;
}) {
  const [value, setValue] = useState("");

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim()) return;
        onSubmit(value.trim());
        setValue("");
      }}
    >
      <div>
        <label htmlFor="ticket-number" className="text-sm text-white/60">
          Ticket number
        </label>
        <Input
          id="ticket-number"
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          placeholder="ATM-4F7K2X-01"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="mt-1.5 h-14 bg-white/5 text-center font-mono text-lg tracking-wider"
        />
        <p className="mt-2 text-xs text-white/40">
          It&apos;s printed under the QR code on their ticket and in their email.
        </p>
      </div>

      <Button
        type="submit"
        size="lg"
        className="h-14 w-full text-base"
        disabled={pending || !value.trim()}
      >
        {pending ? "Checking…" : "Check in"}
      </Button>
    </form>
  );
}
