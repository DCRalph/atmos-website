"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Loader2, ScanFace } from "lucide-react";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { PrimaryAction, SafeAction } from "~/components/door/controls";
import { IdResultScreen, type IdOutcome } from "~/components/door/id-result";
import { playFeedback } from "~/components/door/feedback";
import {
  cropPortrait,
  primeIdReader,
  readIdFromCanvas,
  releaseIdReader,
} from "~/lib/door/id-ocr-web";
import { ID_DOCUMENTS } from "~/lib/ticketing/id-documents";

/**
 * Checking somebody's ID, in a browser.
 *
 * The card is photographed and read **in this page** — Tesseract compiled to
 * WebAssembly, served from our own origin. The photograph is never uploaded.
 * What goes to the server is the recognised text and, when staff tap the face
 * on the card, a crop of it; everything else printed on the document is
 * discarded here, before anything is sent.
 *
 * The flow is deliberately linear rather than clever: freeze the frame, tap the
 * face, get a verdict. Recognition starts the moment the frame freezes and is
 * waited on after the tap, so the two seconds it takes are spent while a person
 * is already doing something.
 *
 * Typing the details in is one tap away at every point, not a punishment for
 * failure. A scratched licence under a doorway light is a normal Tuesday, and a
 * door with a queue cannot be left with nowhere to go.
 */

type Stage =
  | { kind: "live" }
  | { kind: "captured" }
  | { kind: "reading" }
  | { kind: "manual" };

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const stillRef = useRef<HTMLCanvasElement | null>(null);
  const readingRef = useRef<Promise<string[] | null> | null>(null);

  const [stage, setStage] = useState<Stage>({ kind: "live" });
  const [stillUrl, setStillUrl] = useState<string | null>(null);
  const [portrait, setPortrait] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<IdOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

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
    onError: (cause) => {
      setError(cause.message);
      setStage({ kind: "captured" });
    },
  });

  // The engine is eight megabytes and compiles for a second or two. Starting it
  // when the tab opens means the first card of the night is not the one that
  // pays for it.
  useEffect(() => {
    primeIdReader();
    return () => void releaseIdReader();
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (cause) {
        if (cancelled) return;
        setCameraError(
          cause instanceof Error && cause.name === "NotAllowedError"
            ? "Camera access was blocked. Allow it in your browser settings, then reload."
            : "Couldn't start the camera.",
        );
      }
    }

    void start();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);

    stillRef.current = canvas;
    setStillUrl(canvas.toDataURL("image/jpeg", 0.85));
    setError(null);
    setPortrait(null);
    // Started now, awaited after the tap: the recognition and the staffer's
    // next move happen at the same time rather than one after the other.
    readingRef.current = readIdFromCanvas(canvas);
    setStage({ kind: "captured" });
  }, []);

  /** Finish the check, with or without a portrait. */
  const submit = useCallback(
    async (crop: string | null) => {
      setStage({ kind: "reading" });
      const lines = await (readingRef.current ?? Promise.resolve(null));

      if (!lines) {
        setError(
          "Couldn't read that card. Try again with it flat and the light off the plastic, or type the details in.",
        );
        setStage({ kind: "captured" });
        playFeedback("warn");
        return;
      }

      check.mutate({
        eventId,
        ticketId,
        portrait: crop ?? undefined,
        reading: { kind: "ocr", lines },
      });
    },
    [check, eventId, ticketId],
  );

  /** Where they tapped on the still, as a fraction of the frame. */
  const onTapFace = useCallback(
    (event: React.MouseEvent<HTMLImageElement>) => {
      const canvas = stillRef.current;
      if (!canvas) return;

      const box = event.currentTarget.getBoundingClientRect();
      const crop = cropPortrait(
        canvas,
        (event.clientX - box.left) / box.width,
        (event.clientY - box.top) / box.height,
      );
      setPortrait(crop);
      void submit(crop);
    },
    [submit],
  );

  const reset = useCallback(() => {
    setOutcome(null);
    setPortrait(null);
    setStillUrl(null);
    setError(null);
    stillRef.current = null;
    readingRef.current = null;
    setStage({ kind: "live" });
  }, []);

  return (
    <>
      <div className="space-y-4">
        <p className="border-2 border-white/10 bg-white/5 p-3 text-sm text-white/60">
          Reads the card on this device — the photo is never uploaded. We keep
          the name, date of birth and a photo of the face to check age and entry
          bans, and delete it after 90 days unless there&apos;s a ban.
        </p>

        {cameraError ? (
          <div className="flex flex-col items-center gap-3 border-2 border-white/10 bg-black p-8 text-center">
            <CameraOff className="size-8 text-white/40" aria-hidden />
            <p className="text-sm text-white/60">{cameraError}</p>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStage({ kind: "manual" })}
            >
              Type the details in
            </Button>
          </div>
        ) : stage.kind === "manual" ? (
          <ManualIdEntry
            pending={check.isPending}
            onCancel={() => setStage({ kind: "live" })}
            onSubmit={(fields) => {
              setPortrait(null);
              check.mutate({
                eventId,
                ticketId,
                reading: { kind: "fields", ...fields },
              });
            }}
          />
        ) : (
          <>
            <div className="relative overflow-hidden border-2 border-white/10 bg-black">
              <video
                ref={videoRef}
                className={`aspect-[4/3] w-full object-cover ${
                  stillUrl ? "invisible absolute" : ""
                }`}
                playsInline
                muted
              />

              {stillUrl ? (
                // A data URI produced in this component from a frame that must
                // never leave the device. There is nothing to optimise and
                // nowhere to send it.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={stillUrl}
                  alt="The captured card"
                  onClick={onTapFace}
                  className="aspect-[4/3] w-full cursor-crosshair object-cover"
                />
              ) : (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-[6%] inset-y-[12%] border-2 border-white/35"
                />
              )}

              {stage.kind === "reading" || check.isPending ? (
                <div className="absolute inset-0 grid place-items-center bg-black/70 text-sm text-white/80">
                  <p className="flex flex-col items-center gap-3">
                    <Loader2 className="size-8 animate-spin" aria-hidden />
                    Reading the card…
                  </p>
                </div>
              ) : null}
            </div>

            {error ? (
              <p className="border-2 border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
                {error}
              </p>
            ) : null}

            {stage.kind === "captured" ? (
              <div className="space-y-3">
                <p className="flex items-center justify-center gap-2 text-center text-sm text-white/70">
                  <ScanFace className="size-4" aria-hidden />
                  Tap their photo on the card
                </p>
                <PrimaryAction onClick={() => void submit(null)}>
                  Check without a photo
                </PrimaryAction>
                <SafeAction onClick={reset}>Retake</SafeAction>
              </div>
            ) : stage.kind === "live" ? (
              <PrimaryAction onClick={capture}>
                <Camera className="size-5" aria-hidden />
                Capture the ID
              </PrimaryAction>
            ) : null}

            <button
              type="button"
              onClick={() => setStage({ kind: "manual" })}
              className="w-full text-center text-xs text-white/40 underline-offset-4 hover:underline"
            >
              Card won&apos;t read? Type it in
            </button>

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
          </>
        )}
      </div>

      {outcome ? (
        <IdResultScreen
          eventId={eventId}
          outcome={outcome}
          ticketId={ticketId}
          attendeeName={attendeeName}
          isManager={isManager}
          localPortrait={portrait}
          onRetake={reset}
          onDismiss={reset}
        />
      ) : null}
    </>
  );
}

/**
 * Typing the card in by hand.
 *
 * The same endpoint as a camera read — a correction and a manual entry are the
 * same thing to the server — so the ban lookup, the age arithmetic and the
 * record behave identically. Only the document type has to be chosen, because
 * it is the one field nobody can infer from what was typed and it decides
 * whether the ID counts as evidence of age at all.
 */
function ManualIdEntry({
  pending,
  onCancel,
  onSubmit,
}: {
  pending: boolean;
  onCancel: () => void;
  onSubmit: (fields: {
    documentType: (typeof ID_DOCUMENTS)[number]["value"];
    documentNumber?: string;
    fullName: string;
    dateOfBirth: string;
  }) => void;
}) {
  const [documentType, setDocumentType] =
    useState<(typeof ID_DOCUMENTS)[number]["value"]>("NZ_DRIVER_LICENCE");
  const [fullName, setFullName] = useState("");
  const [birth, setBirth] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");

  const dateOfBirth = toIsoDate(birth);
  const ready = fullName.trim().length > 1 && dateOfBirth !== null;

  return (
    <div className="space-y-4">
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
        onClick={() =>
          dateOfBirth &&
          onSubmit({
            documentType,
            fullName: fullName.trim(),
            dateOfBirth,
            documentNumber: documentNumber.trim() || undefined,
          })
        }
        disabled={!ready || pending}
      >
        {pending
          ? "Checking…"
          : ready
            ? "Check this person"
            : "Name and birthday first"}
      </PrimaryAction>
      <SafeAction onClick={onCancel} disabled={pending}>
        Back to the camera
      </SafeAction>
    </div>
  );
}

/**
 * `15/01/1990` → `1990-01-15`.
 *
 * Day-first, with no cleverness about the American order: somebody typing into
 * a New Zealand door app, under a label that says day/month, means day/month.
 * The camera path is where ambiguity has to be handled, and it is handled
 * there.
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

  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
