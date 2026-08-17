"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  FileImage,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Type,
} from "lucide-react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { AdminSection } from "~/components/admin/admin-section";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import {
  primeIdReader,
  readIdFromCanvas,
  releaseIdReader,
} from "~/lib/door/id-ocr-web";

type Preview = RouterOutputs["patrons"]["previewRead"];

/**
 * The ID reader's test bench.
 *
 * Reading a document is the one part of the door that cannot be trusted to
 * unit tests alone: the parser is tested against text, and what actually
 * decides whether this works on a Friday night is what a camera makes of
 * laminated plastic under a doorway light. So this page exists to put real
 * cards through the real pipeline and show every intermediate step — the raw
 * lines the engine returned, which template claimed them, what it pulled out,
 * and the verdict a door would have reached.
 *
 * **It writes nothing.** No patron record, no retention clock, no row in the
 * count a door reads back. Testing the reader on a colleague's licence must not
 * put that colleague in the database, so the whole page runs through
 * `patrons.previewRead`, which is read-only in the way `checkTicket` is on the
 * door router.
 *
 * The three sources exist for three different questions. Paste is for "does the
 * parser handle this shape" and needs no camera at all. Upload is for "does it
 * cope with this card", from a photo taken on anything. Camera is for the real
 * thing, end to end, on the device a door would use.
 */

/**
 * Known-good input, so the page is useful before anybody finds a licence.
 *
 * The passport is a real TD3 layout with valid check digits — pasting it should
 * come back `MRZ` and `high`, and if it does not, the engine is fine and the
 * parser has regressed.
 */
const SAMPLES = [
  {
    label: "Passport MRZ",
    hint: "Should read as MRZ, high confidence",
    lines: [
      "P<NZLSMITH<<JANE<ANNE<<<<<<<<<<<<<<<<<<<<<<<",
      "LA12345675NZL9001158M3001019<<<<<<<<<<<<<<06",
    ].join("\n"),
  },
  {
    label: "NZ driver licence",
    hint: "Numbered fields, medium confidence at best",
    lines: [
      "NEW ZEALAND",
      "DRIVER LICENCE",
      "1. SMITH",
      "2. JANE ANNE",
      "3. 15 JAN 1990",
      "4a. 01.03.2020",
      "4b. 01.03.2030",
      "5. AB123456",
    ].join("\n"),
  },
  {
    label: "Ambiguous date",
    hint: "Should flag day/month and ask for confirmation",
    lines: [
      "NEW ZEALAND DRIVER LICENCE",
      "1. SMITH",
      "2. JANE",
      "3. 03/04/1999",
    ].join("\n"),
  },
  {
    label: "Underage",
    hint: "Should come back UNDERAGE against an R18 event",
    lines: [
      "NEW ZEALAND",
      "DRIVER LICENCE",
      "1. YOUNG",
      "2. SAM",
      "3. 15 JAN 2011",
      "5. ZZ999999",
    ].join("\n"),
  },
] as const;

type Source = "paste" | "upload" | "camera";

export default function IdReaderTestPage() {
  const [source, setSource] = useState<Source>("paste");
  const [isR18, setIsR18] = useState(true);
  const [lines, setLines] = useState("");
  const [reading, setReading] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [stillUrl, setStillUrl] = useState<string | null>(null);

  const check = api.patrons.previewRead.useMutation({
    onSuccess: setPreview,
    onError: (error) => toast.error(error.message),
  });

  const run = useCallback(
    (text: string) => {
      const parsed = text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      if (parsed.length === 0) {
        toast.error("Nothing to read.");
        return;
      }

      setPreview(null);
      check.mutate({ isR18, reading: { kind: "ocr", lines: parsed } });
    },
    [check, isR18],
  );

  /** Recognise an image, then run whatever came out of it. */
  const readImage = useCallback(
    async (canvas: HTMLCanvasElement) => {
      setReading(true);
      setPreview(null);
      try {
        const recognised = await readIdFromCanvas(canvas);
        if (!recognised) {
          setLines("");
          toast.error(
            "The engine returned nothing. Try a sharper photo, or check the console for a failed asset load.",
          );
          return;
        }
        setLines(recognised.join("\n"));
        check.mutate({ isR18, reading: { kind: "ocr", lines: recognised } });
      } finally {
        setReading(false);
      }
    },
    [check, isR18],
  );

  return (
    <AdminSection
      title="ID reader test"
      subtitle="Put a real document through the real pipeline"
      backLink={{ href: "/admin/patrons", label: "← ID checks" }}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-6">
        <p className="border-2 border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <strong>Nothing here is saved.</strong> No patron record is created,
          no retention clock starts, and nothing appears in a door&apos;s
          counts. Bans are looked up but never written. Images are recognised in
          this browser and never uploaded.
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex gap-2">
            <SourceButton
              active={source === "paste"}
              onClick={() => setSource("paste")}
              icon={Type}
            >
              Paste text
            </SourceButton>
            <SourceButton
              active={source === "upload"}
              onClick={() => setSource("upload")}
              icon={FileImage}
            >
              Upload a photo
            </SourceButton>
            <SourceButton
              active={source === "camera"}
              onClick={() => setSource("camera")}
              icon={Camera}
            >
              Camera
            </SourceButton>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Switch id="r18" checked={isR18} onCheckedChange={setIsR18} />
            <Label htmlFor="r18">Judge as an R18 event</Label>
          </div>
        </div>

        {source === "upload" && (
          <UploadSource
            busy={reading || check.isPending}
            stillUrl={stillUrl}
            onImage={(canvas, url) => {
              setStillUrl(url);
              void readImage(canvas);
            }}
          />
        )}

        {source === "camera" && (
          <CameraSource
            busy={reading || check.isPending}
            onCapture={(canvas, url) => {
              setStillUrl(url);
              void readImage(canvas);
            }}
          />
        )}

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="lines">
              {source === "paste"
                ? "Recognised lines — one per line"
                : "What the engine returned"}
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLES.map((sample) => (
                <Button
                  key={sample.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  title={sample.hint}
                  onClick={() => {
                    setSource("paste");
                    setLines(sample.lines);
                    setPreview(null);
                  }}
                >
                  {sample.label}
                </Button>
              ))}
            </div>
          </div>

          <Textarea
            id="lines"
            value={lines}
            onChange={(event) => setLines(event.target.value)}
            rows={8}
            placeholder={"1. SMITH\n2. JANE ANNE\n3. 15 JAN 1990"}
            className="font-mono text-sm"
          />
          <p className="text-muted-foreground text-xs">
            Editable — change a line and read it again to see how the parser
            reacts. This is the exact payload a phone or the web door sends.
          </p>
        </div>

        <Button
          type="button"
          onClick={() => run(lines)}
          disabled={check.isPending || reading || lines.trim().length === 0}
        >
          {check.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="size-4" aria-hidden />
          )}
          Read these lines
        </Button>

        {preview && <PreviewResult preview={preview} isR18={isR18} />}
      </div>
    </AdminSection>
  );
}

function SourceButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onClick}
    >
      <Icon className="size-4" aria-hidden />
      {children}
    </Button>
  );
}

/** A photo off disk — the quickest way to try a card you already have a shot of. */
function UploadSource({
  busy,
  stillUrl,
  onImage,
}: {
  busy: boolean;
  stillUrl: string | null;
  onImage: (canvas: HTMLCanvasElement, url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(
    async (file: File) => {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
      bitmap.close();
      onImage(canvas, canvas.toDataURL("image/jpeg", 0.8));
    },
    [onImage],
  );

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void load(file);
          event.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        <FileImage className="size-4" aria-hidden />
        Choose a photo
      </Button>
      {stillUrl && <Still url={stillUrl} busy={busy} />}
    </div>
  );
}

/** The real thing: the camera a door would actually use. */
function CameraSource({
  busy,
  onCapture,
}: {
  busy: boolean;
  onCapture: (canvas: HTMLCanvasElement, url: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  // The engine is eight megabytes and compiles for a second or two. Warm it up
  // while somebody is still lining the card up.
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
      } catch {
        if (!cancelled) setError("Couldn't start the camera.");
      }
    }

    void start();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  if (error) {
    return <p className="text-muted-foreground text-sm">{error}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden border bg-black">
        <video
          ref={videoRef}
          className="aspect-[4/3] w-full object-cover"
          playsInline
          muted
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-[6%] inset-y-[12%] border-2 border-white/40"
        />
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() => {
          const video = videoRef.current;
          if (!video || video.videoWidth === 0) return;
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          canvas.getContext("2d")?.drawImage(video, 0, 0);
          onCapture(canvas, canvas.toDataURL("image/jpeg", 0.8));
        }}
      >
        <Camera className="size-4" aria-hidden />
        Capture and read
      </Button>
    </div>
  );
}

function Still({ url, busy }: { url: string; busy: boolean }) {
  return (
    <div className="relative inline-block border">
      {/* A data URI made in this browser from an image that must not leave it.
          There is nothing to optimise and nowhere to send it. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="The document being tested" className="max-h-64" />
      {busy && (
        <div className="absolute inset-0 grid place-items-center bg-black/60 text-sm text-white">
          <span className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Reading…
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Everything the pipeline produced, in the order it produced it.
 *
 * Laid out as steps rather than as a verdict with details, because when this
 * goes wrong the useful question is *where* — a template that failed to claim
 * the card and a template that claimed it and misread the birthday look
 * identical if all you are shown is the answer.
 */
function PreviewResult({
  preview,
  isR18,
}: {
  preview: Preview;
  isR18: boolean;
}) {
  const verdictTone =
    preview.wouldBe === "PASS"
      ? "bg-emerald-600"
      : preview.wouldBe === "BANNED" || preview.wouldBe === "UNDERAGE"
        ? "bg-red-700"
        : preview.wouldBe === "UNREADABLE"
          ? "bg-neutral-600"
          : "bg-amber-600";

  return (
    <div className="space-y-6 border-t pt-6">
      <div className={`p-4 text-white ${verdictTone}`}>
        <p className="text-xs tracking-widest uppercase opacity-80">
          A door would say
        </p>
        <p className="text-2xl font-black tracking-tight">
          {preview.wouldBe.replaceAll("_", " ")}
        </p>
        <p className="mt-1 text-sm opacity-90">
          Judged as {isR18 ? "an R18" : "an all-ages"} event, in
          Pacific/Auckland.
        </p>
      </div>

      <Step
        title="How it was read"
        badges={[
          { label: preview.readAs, variant: "secondary" as const },
          {
            label: `${preview.confidence} confidence`,
            variant:
              preview.confidence === "high"
                ? ("default" as const)
                : ("outline" as const),
          },
        ]}
      >
        {preview.readAs === "GENERIC" && (
          <p className="text-muted-foreground text-sm">
            No template claimed this document, so the fields below are
            inference: the oldest plausible date is treated as the birthday and
            the longest capitalised lines as the name. That is why the
            confidence is low.
          </p>
        )}
        {preview.readAs === "MRZ" && preview.confidence === "high" && (
          <p className="text-muted-foreground text-sm">
            The machine-readable zone&apos;s own check digits verified, so these
            fields are arithmetically confirmed rather than guessed.
          </p>
        )}
      </Step>

      <Step title="What it pulled out">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <Field label="Name">{preview.document.fullName ?? "—"}</Field>
          <Field label="Surname">{preview.document.familyName ?? "—"}</Field>
          <Field label="Given names">
            {preview.document.givenNames ?? "—"}
          </Field>
          <Field label="Date of birth">
            {preview.document.dateOfBirth ?? "—"}
          </Field>
          <Field label="Age">
            {preview.ageYears === null ? "—" : `${preview.ageYears}`}
          </Field>
          <Field label="Document">{preview.document.documentType}</Field>
          <Field label="Number">{preview.document.documentNumber ?? "—"}</Field>
          <Field label="Expiry">
            {preview.document.expiry ?? "—"}
            {preview.expired ? " (expired)" : ""}
          </Field>
          <Field label="Nationality">
            {preview.document.nationality ?? "—"}
          </Field>
        </dl>
        {!preview.approvedEvidence && (
          <p className="mt-3 flex items-start gap-2 text-sm text-amber-600">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            Not approved evidence of age in New Zealand. Only a NZ driver
            licence, a passport or a Kiwi Access Card counts.
          </p>
        )}
      </Step>

      {preview.ambiguities.length > 0 && (
        <Step title="What it wasn't sure about">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {preview.ambiguities.map((ambiguity) => (
              <li key={ambiguity}>{ambiguity}</li>
            ))}
          </ul>
        </Step>
      )}

      {preview.warnings.length > 0 && (
        <Step title="What the door would be told">
          <ul className="space-y-2 text-sm">
            {preview.warnings.map((warning) => (
              <li key={`${warning.code}-${warning.label}`}>
                <span className="font-semibold">{warning.label}</span> —{" "}
                {warning.detail}
              </li>
            ))}
          </ul>
        </Step>
      )}

      <Step title="Do we know them">
        {preview.known ? (
          <p className="text-sm">
            Yes — {preview.known.fullName}, checked {preview.known.checkCount}×
            since {preview.known.firstSeenAt.toISOString().slice(0, 10)}.
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">
            No record for this document. A real check would create one.
          </p>
        )}

        {preview.ban && (
          <p className="mt-2 text-sm text-red-600">
            Banned ({preview.ban.reason}
            {preview.ban.matchedOn === "NAME_AND_DOB"
              ? ", matched on name and date of birth rather than this document"
              : ""}
            ){preview.ban.note ? `: “${preview.ban.note}”` : ""}
          </p>
        )}
      </Step>
    </div>
  );
}

function Step({
  title,
  badges,
  children,
}: {
  title: string;
  badges?: { label: string; variant: "default" | "secondary" | "outline" }[];
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xs font-semibold tracking-widest uppercase">
          {title}
        </h2>
        {badges?.map((badge) => (
          <Badge key={badge.label} variant={badge.variant}>
            {badge.label}
          </Badge>
        ))}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs tracking-wide uppercase">
        {label}
      </dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}
