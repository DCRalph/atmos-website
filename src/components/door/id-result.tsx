"use client";

import { useState } from "react";
import { AlertTriangle, Ban, BadgeCheck, HelpCircle } from "lucide-react";

import { api, type RouterOutputs } from "~/trpc/react";
import {
  DenyReasonPicker,
  ExceptionAction,
  SafeAction,
} from "~/components/door/controls";
import { BanForm } from "~/components/door/ban-form";
import type { DenyReasonValue } from "~/lib/ticketing/deny-reasons";

export type IdOutcome = RouterOutputs["door"]["checkId"];

/**
 * The verdict about a person, full screen.
 *
 * The web twin of `mobile/src/components/door/id-result.tsx`, and deliberately
 * the same screen: the same colours, the same order, the same words, so a
 * staffer who learned the door on a phone is not relearning it on a laptop.
 * Same rule as everywhere else here — **the bottom button is always the
 * harmless one.**
 *
 * Two things this screen does that the ticket result does not.
 *
 * Any stored portrait is shown at a size that can be compared with a face,
 * because every check ends with somebody looking from the screen to the queue
 * and back. A green screen against the wrong face is worse than no check at
 * all. Nothing captures a portrait today — that arrives with an ID SDK — so in
 * practice this is blank until one is wired up.
 *
 * And the disclaimer is printed on every outcome, including a pass. Nothing
 * here can tell a good forgery from the real thing: it takes the details it is
 * given and does the arithmetic. A door that forgets that will wave through a
 * decent fake precisely *because* the screen went green.
 */

const TONE = {
  pass: { bg: "bg-emerald-700", icon: BadgeCheck },
  banned: { bg: "bg-red-900", icon: Ban },
  refused: { bg: "bg-red-700", icon: Ban },
  caution: { bg: "bg-amber-600", icon: AlertTriangle },
  unreadable: { bg: "bg-neutral-700", icon: HelpCircle },
} as const;

function toneFor(result: IdOutcome["result"]): keyof typeof TONE {
  switch (result) {
    case "PASS":
      return "pass";
    case "BANNED":
      return "banned";
    case "UNDERAGE":
      return "refused";
    case "DOCUMENT_EXPIRED":
    case "NOT_APPROVED_EVIDENCE":
    case "ALREADY_USED_TONIGHT":
    case "NAME_MISMATCH":
      return "caution";
    default:
      return "unreadable";
  }
}

export function IdResultScreen({
  eventId,
  outcome,
  ticketId,
  attendeeName,
  isManager,
  onDismiss,
}: {
  eventId: string;
  outcome: IdOutcome;
  ticketId?: string;
  attendeeName?: string | null;
  isManager: boolean;
  onDismiss: () => void;
}) {
  const [current, setCurrent] = useState(outcome);
  const [banning, setBanning] = useState(false);
  const [refusing, setRefusing] = useState(false);
  const utils = api.useUtils();

  const ban = api.door.banPatron.useMutation({
    onSuccess: () => {
      setBanning(false);
      setCurrent({
        ...current,
        result: "BANNED",
        ok: false,
        headline: "Banned",
        message: "Barred from Atmos events from now on.",
      });
      void utils.door.idCheckSummary.invalidate();
    },
  });

  const deny = api.door.deny.useMutation({
    onSuccess: () => {
      setRefusing(false);
      void utils.door.summary.invalidate();
      void utils.door.doorList.invalidate();
      void utils.door.recentScans.invalidate();
      onDismiss();
    },
  });

  const tone = TONE[toneFor(current.result)];
  const Icon = tone.icon;
  const person = current.person;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col text-white ${tone.bg}`}
      role="alertdialog"
      aria-label={current.headline}
    >
      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-8 text-center">
        <Icon className="size-12 opacity-90" aria-hidden />
        <p className="mt-3 text-4xl leading-none font-black tracking-tight">
          {current.headline}
        </p>

        {/* Only ever a stored portrait, and only when something put one there.
            Nothing here produces one today — that comes with an SDK. */}
        {person?.photoPath ? (
          // A private, no-store route that re-checks door access on every
          // request, so it cannot go through the image optimiser — and a face
          // off an ID must not be cached at an edge in any case.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={person.photoPath}
            alt="Photo from the ID"
            className="mt-5 h-40 w-33 border-2 border-white/50 bg-black/25 object-cover"
          />
        ) : null}

        {person ? (
          <>
            <p className="mt-4 text-2xl font-extrabold">{person.fullName}</p>
            <p className="text-lg opacity-90">
              {person.dateOfBirth} · {person.ageYears} years old
            </p>
            <p className="mt-1 font-mono text-xs opacity-60">
              {person.previousChecks === 0
                ? "First time we've checked this ID"
                : `Checked ${person.previousChecks}× before · ${person.previousVisits} other night${person.previousVisits === 1 ? "" : "s"}`}
            </p>
          </>
        ) : null}

        <p className="mt-3 max-w-sm text-sm opacity-90">{current.message}</p>

        {current.ban ? (
          <div className="mt-5 w-full max-w-sm border-2 border-white/55 bg-black/25 p-4 text-left">
            <p className="text-sm font-extrabold">BANNED</p>
            <p className="mt-1 text-sm opacity-85">
              {current.ban.note ?? current.ban.reason}
            </p>
            {current.ban.bannedByName ? (
              <p className="mt-1 text-xs opacity-70">
                Set by {current.ban.bannedByName}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Everything wrong, not only the headline. An expired card on an
            underage punter is two facts, and hiding the second behind the
            first is how the second gets missed. */}
        {current.warnings.map((warning) => (
          <div
            key={`${warning.code}-${warning.label}`}
            className="mt-3 w-full max-w-sm border-2 border-black/25 bg-black/20 p-3 text-left"
          >
            <p className="text-sm font-extrabold">
              {warning.label.toUpperCase()}
            </p>
            <p className="mt-1 text-sm opacity-85">{warning.detail}</p>
          </div>
        ))}

        <p className="mt-6 max-w-xs text-xs opacity-55">
          This checks the details it was given. It can&apos;t spot a fake — look
          at the card.
        </p>
      </div>

      <div className="space-y-3 p-5 pb-8">
        {/* Refusing needs a ticket to record against, exactly as on the scan
            result. An ID checked on its own has nothing to attach a refusal
            to — the ban below is the tool for that case. */}
        {ticketId ? (
          <ExceptionAction
            onClick={() => setRefusing(true)}
            hint="Records it against their ticket and your name"
          >
            Refuse entry
          </ExceptionAction>
        ) : null}

        {isManager && person ? (
          <ExceptionAction
            onClick={() => setBanning(true)}
            hint="Every future door sees it until it's lifted"
          >
            Ban from all events
          </ExceptionAction>
        ) : null}

        {/* Always last, always white, always harmless. */}
        <SafeAction onClick={onDismiss}>Next</SafeAction>
      </div>

      {/* Both of these paint themselves over the whole screen, so they are
          siblings of the verdict rather than buttons inside it. */}
      {refusing && ticketId ? (
        <DenyReasonPicker
          attendee={person?.fullName ?? attendeeName ?? null}
          pending={deny.isPending}
          onCancel={() => setRefusing(false)}
          onConfirm={(reason: DenyReasonValue, note: string) =>
            deny.mutate({
              eventId,
              ticketId,
              reason,
              note: note || undefined,
            })
          }
        />
      ) : null}

      {banning && person ? (
        <BanForm
          name={person.fullName}
          pending={ban.isPending}
          onCancel={() => setBanning(false)}
          onConfirm={(reason, note, expiresInDays) =>
            ban.mutate({
              eventId,
              patronId: person.patronId,
              reason,
              note: note || undefined,
              expiresInDays: expiresInDays ?? undefined,
            })
          }
        />
      ) : null}
    </div>
  );
}
