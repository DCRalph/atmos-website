"use client";

import { useState } from "react";

import { api } from "~/trpc/react";
import { Input } from "~/components/ui/input";
import { PrimaryAction } from "~/components/door/controls";
import { IdResultScreen, type IdOutcome } from "~/components/door/id-result";
import { playFeedback } from "~/components/door/feedback";
import { ID_DOCUMENTS } from "~/lib/ticketing/id-documents";

/**
 * Checking somebody's ID.
 *
 * Staff read the card and type what is on it; everything after that — the age
 * arithmetic in the venue's timezone, the ban list, whether the name matches
 * the ticket, whether the document is even accepted evidence of age in New
 * Zealand — is the server's job and is the same however these fields arrived.
 *
 * **There is no camera here on purpose.** Reading a licence off a photograph is
 * a specialist job and the home-grown attempt was not good enough to put in
 * front of a queue. That work belongs to an ID SDK, and when one is chosen it
 * fills in this same form and submits it — see `~/lib/ticketing/id-reading`,
 * which is the seam, and `docs/ticketing/ID-CHECKS.md` for the options.
 *
 * Typing is slower than scanning and nobody pretends otherwise. It is also
 * exact, which the scanning was not.
 */
export function IdPanel({
  eventId,
  isManager,
  ticketId,
  attendeeName,
}: {
  eventId: string;
  isManager: boolean;
  /** Present when this was opened from a scan result, which enables the
   *  name comparison and the "already used tonight" check. */
  ticketId?: string;
  attendeeName?: string | null;
}) {
  const [outcome, setOutcome] = useState<IdOutcome | null>(null);
  const [documentType, setDocumentType] =
    useState<(typeof ID_DOCUMENTS)[number]["value"]>("NZ_DRIVER_LICENCE");
  const [fullName, setFullName] = useState("");
  const [birth, setBirth] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");

  const utils = api.useUtils();
  // "How many IDs did you check, and how many did you turn away" is what a
  // licensing inspector asks the following week, and it is a much easier
  // question to answer from the door than from the database.
  const tally = api.door.idCheckSummary.useQuery({ eventId });

  const check = api.door.checkId.useMutation({
    onSuccess: (result) => {
      setOutcome(result);
      void utils.door.idCheckSummary.invalidate();
      playFeedback(
        result.ok
          ? "success"
          : result.result === "BANNED" || result.result === "UNDERAGE"
            ? "error"
            : "warn",
      );
    },
  });

  const dateOfBirth = toIsoDate(birth);
  const ready = fullName.trim().length > 1 && dateOfBirth !== null;

  const reset = () => {
    setOutcome(null);
    setFullName("");
    setBirth("");
    setDocumentNumber("");
  };

  return (
    <>
      <div className="space-y-4">
        <p className="border-2 border-white/10 bg-white/5 p-3 text-sm text-white/60">
          We keep the name, date of birth and document number to check age and
          entry bans, and delete it after 90 days unless there&apos;s a ban.
        </p>

        <div>
          <p className="text-xs tracking-widest uppercase opacity-60">
            Which document
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {ID_DOCUMENTS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setDocumentType(option.value)}
                aria-pressed={documentType === option.value}
                className={`flex h-12 items-center justify-center border-2 px-2 text-center text-sm font-semibold ${
                  documentType === option.value
                    ? "border-white bg-white text-black"
                    : "border-white/20 bg-white/5 text-white/70"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="text-xs tracking-widest uppercase opacity-60">
            Name, as printed
          </span>
          <Input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Jane Anne Smith"
            className="mt-1.5 h-12"
          />
        </label>

        <label className="block">
          <span className="text-xs tracking-widest uppercase opacity-60">
            Date of birth — day/month/year
          </span>
          <Input
            value={birth}
            onChange={(event) => setBirth(event.target.value)}
            inputMode="numeric"
            placeholder="15/01/1990"
            className="mt-1.5 h-12"
          />
        </label>

        <label className="block">
          <span className="text-xs tracking-widest uppercase opacity-60">
            Document number — optional, but it&apos;s how we know them again
          </span>
          <Input
            value={documentNumber}
            onChange={(event) =>
              setDocumentNumber(event.target.value.toUpperCase())
            }
            placeholder="AB123456"
            className="mt-1.5 h-12"
          />
        </label>

        <PrimaryAction
          onClick={() => {
            if (!dateOfBirth) return;
            check.mutate({
              eventId,
              ticketId,
              reading: {
                documentType,
                fullName: fullName.trim(),
                dateOfBirth,
                documentNumber: documentNumber.trim() || undefined,
              },
            });
          }}
          disabled={!ready || check.isPending}
        >
          {check.isPending
            ? "Checking…"
            : ready
              ? "Check this person"
              : "Name and birthday first"}
        </PrimaryAction>

        {tally.data && tally.data.checked > 0 ? (
          <p className="text-center text-xs text-white/40">
            {tally.data.checked} ID
            {tally.data.checked === 1 ? "" : "s"} checked tonight
            {tally.data.underage > 0
              ? ` · ${tally.data.underage} underage`
              : ""}
            {tally.data.banned > 0 ? ` · ${tally.data.banned} banned` : ""}
          </p>
        ) : null}
      </div>

      {outcome ? (
        <IdResultScreen
          eventId={eventId}
          outcome={outcome}
          ticketId={ticketId}
          attendeeName={attendeeName}
          isManager={isManager}
          onDismiss={reset}
        />
      ) : null}
    </>
  );
}

/**
 * `15/01/1990` → `1990-01-15`.
 *
 * Day-first, with no cleverness about the American order: somebody typing into
 * a New Zealand door app, under a label that says day/month, means day/month.
 */
function toIsoDate(value: string): string | null {
  const match = /^(\d{1,2})\s*[/.\-\s]\s*(\d{1,2})\s*[/.\-\s]\s*(\d{4})$/.exec(
    value.trim(),
  );
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  // Rejects the 31st of February and friends, which `Date` would otherwise
  // roll forward into March and hand back as a date nobody typed.
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
