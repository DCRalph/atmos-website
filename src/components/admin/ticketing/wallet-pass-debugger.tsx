"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Download,
  Mail,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import {
  PassDesignField,
  type InheritedLayer,
  type PassDesignExtraTab,
} from "~/components/admin/ticketing/pass-design-field";
import type { PassPreviewContent } from "~/components/admin/ticketing/pass-preview";
import {
  resolveTicketPassDesign,
  type EventPassDesign,
  type PassDesign,
} from "~/lib/ticketing/pass-design";
import {
  PASS_FIELD_SLOTS,
  PASS_FIELD_SLOT_LABELS,
  barcodesOf,
  blankDraft,
  fieldsOf,
  isJsonObject,
  parseJsonObject,
  prettyJson,
  semanticsOf,
  textOf,
  walletPassDebugComposeResponseSchema,
  walletPassDebugDefaultsResponseSchema,
  walletPassDebugDraftSchema,
  type JsonObject,
  type JsonValue,
  type PassFieldSlot,
  type WalletPassAsset,
  type WalletPassDebugComposeResponse,
  type WalletPassDebugDefaultsResponse,
  type WalletPassDebugDraft,
  type WalletPassSource,
} from "~/lib/ticketing/wallet-pass-debug";

/**
 * The wallet debugger.
 *
 * Pick a source, and the server composes the pass a holder would get. The
 * Look, Links, Back and Phone tabs are the event editor's own, laid over the
 * source's design; Fields, Semantics, Advanced and JSON edit the composed
 * pass.json directly, as a patch that survives the source recomposing under
 * it. Every change recomposes, so the preview, the validation and the bundle
 * listing are always of the pass that would be signed.
 */

const API_URL = "/api/admin/wallet-pass-debug";

type Patch = JsonObject;
type Pending = "download" | "send" | null;

async function post<T>(
  body: unknown,
  parse: (value: unknown) => T,
): Promise<T> {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error: unknown = await response.json().catch(() => null);
    throw new Error(
      isJsonObject(error) && typeof error.error === "string"
        ? error.error
        : "The request failed.",
    );
  }
  return parse(await response.json());
}

/** ISO in the pass, local time in the box. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInput(local: string): string | undefined {
  if (!local) return undefined;
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function fileAsAsset(file: File): Promise<WalletPassAsset> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.onload = () => {
      const value = reader.result;
      if (typeof value !== "string") {
        reject(new Error(`Could not read ${file.name}.`));
        return;
      }
      resolve({
        fileName: file.name,
        dataBase64: value.slice(value.indexOf(",") + 1),
      });
    };
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** What the preview says, read off the composed pass.json. */
function previewContent(
  manifest: JsonObject,
  context: WalletPassDebugComposeResponse["context"],
): PassPreviewContent {
  const field = (item: JsonObject) => ({
    label: textOf(item.label) || textOf(item.key),
    value: textOf(item.value),
  });
  const header = fieldsOf(manifest, "headerFields")[0];
  const primary = fieldsOf(manifest, "primaryFields")[0];
  return {
    eventName:
      [
        primary ? textOf(primary.value) : "",
        textOf(semanticsOf(manifest).eventName),
        context.eventName,
      ].find((name) => name.length > 0) ?? "",
    header: header ? field(header) : null,
    fields: [
      ...fieldsOf(manifest, "secondaryFields"),
      ...fieldsOf(manifest, "auxiliaryFields"),
    ].map(field),
    back: fieldsOf(manifest, "backFields").map((item) => {
      const row = field(item);
      return { ...row, link: /https?:\/\/|@/.test(row.value) };
    }),
    barcodeAlt: textOf(barcodesOf(manifest)[0]?.altText),
    venueAddress: context.venueAddress,
  };
}

/** The event's own layer, without its per-level overrides. */
function eventLayer(design: EventPassDesign): PassDesign {
  const { levels, ...rest } = design;
  void levels;
  return rest;
}

export function WalletPassDebugger() {
  const [defaults, setDefaults] =
    useState<WalletPassDebugDefaultsResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<WalletPassDebugDraft>(() =>
    blankDraft({ kind: "standalone" }),
  );
  const [composed, setComposed] =
    useState<WalletPassDebugComposeResponse | null>(null);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [composing, setComposing] = useState(true);
  const [recipient, setRecipient] = useState("");
  const [pending, setPending] = useState<Pending>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(API_URL, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load the debugger.");
        return walletPassDebugDefaultsResponseSchema.parse(
          await response.json(),
        );
      })
      .then(setDefaults)
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setLoadError(
            cause instanceof Error
              ? cause.message
              : "Could not load the debugger.",
          );
        }
      });
    return () => controller.abort();
  }, [reloadKey]);

  // Every change recomposes, a beat after the last keystroke. Responses that
  // arrive out of order are dropped: only the latest draft's pass is shown.
  const request = useRef(0);
  useEffect(() => {
    const id = ++request.current;
    setComposing(true);
    const timer = setTimeout(() => {
      post({ action: "compose", draft }, (value) =>
        walletPassDebugComposeResponseSchema.parse(value),
      )
        .then((response) => {
          if (id !== request.current) return;
          setComposed(response);
          setComposeError(null);
        })
        .catch((cause) => {
          if (id !== request.current) return;
          setComposeError(
            cause instanceof Error ? cause.message : "Could not compose.",
          );
        })
        .finally(() => {
          if (id === request.current) setComposing(false);
        });
    }, 350);
    return () => clearTimeout(timer);
  }, [draft]);

  const setPatch = (update: (patch: Patch) => Patch) =>
    setDraft((current) => ({ ...current, patch: update(current.patch) }));
  const changed =
    Object.keys(draft.design).length > 0 ||
    Object.keys(draft.patch).length > 0 ||
    draft.assets.length > 0 ||
    draft.localizations.length > 0 ||
    draft.personalization !== null;

  const configured = defaults?.configured ?? false;
  const certificateDays = defaults?.certificateDaysRemaining ?? null;
  const signingReady =
    configured && (certificateDays === null || certificateDays >= 0);
  const certificateStatus = !defaults
    ? "Loading"
    : !configured
      ? "Not configured"
      : certificateDays === null
        ? "Certificate ready"
        : certificateDays < 0
          ? `Certificate expired ${Math.abs(certificateDays)} days ago`
          : certificateDays === 0
            ? "Certificate expires today"
            : `Certificate ready · ${certificateDays} days left`;
  const certificateDot = !signingReady
    ? "bg-destructive"
    : certificateDays !== null && certificateDays <= 30
      ? "bg-amber-400"
      : "bg-emerald-400";

  const level = composed?.level;
  const layers: InheritedLayer[] = composed
    ? [
        {
          source: `from ${composed.level.label} at the event`,
          design: composed.eventDesign.levels?.[composed.level.code] ?? {},
        },
        {
          source: `from ${composed.level.label} level`,
          design: composed.level.passDesign,
        },
        { source: "from the event", design: eventLayer(composed.eventDesign) },
        { source: "from the gig", design: composed.gig },
      ].filter((layer) => Object.keys(layer.design).length > 0)
    : [];
  const chip =
    composed && level
      ? resolveTicketPassDesign(
          composed.eventDesign,
          {
            code: level.code,
            short: level.short,
            rank: level.rank,
            passDesign: level.passDesign,
          },
          composed.gig,
          draft.design,
        ).chip
      : null;

  const submit = async (action: Exclude<Pending, null>) => {
    const validated = walletPassDebugDraftSchema.safeParse(draft);
    if (!validated.success) {
      toast.error(
        validated.error.issues[0]?.message ??
          "The pass contains invalid values.",
      );
      return;
    }
    setPending(action);
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          recipient: action === "send" ? recipient : undefined,
          draft: validated.data,
        }),
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        throw new Error(
          isJsonObject(body) && typeof body.error === "string"
            ? body.error
            : "Could not build the pass.",
        );
      }
      if (action === "download") {
        const blob = await response.blob();
        const disposition = response.headers.get("content-disposition") ?? "";
        const filename =
          /filename="([^"]+)"/.exec(disposition)?.[1] ?? "pass.pkpass";
        const href = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = href;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(href);
        toast.success("Pass downloaded");
      } else {
        toast.success(`Pass sent to ${recipient}`);
      }
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Could not build the pass.",
      );
    } finally {
      setPending(null);
    }
  };

  if (loadError) {
    return (
      <div className="border-destructive/50 bg-destructive/5 rounded-lg border p-5">
        <p className="font-medium">The debugger could not load</p>
        <p className="text-muted-foreground mt-1 text-sm">{loadError}</p>
        <Button
          className="mt-4"
          variant="outline"
          onClick={() => {
            setLoadError(null);
            setReloadKey((value) => value + 1);
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  const manifest = composed?.manifest ?? {};
  const extraTabs: PassDesignExtraTab[] = [
    {
      id: "fields",
      label: "Fields",
      set: isJsonObject(draft.patch.eventTicket),
      content: (
        <FieldsTab manifest={manifest} patch={draft.patch} onPatch={setPatch} />
      ),
    },
    {
      id: "semantics",
      label: "Semantics",
      set: isJsonObject(draft.patch.semantics),
      content: (
        <SemanticsTab
          manifest={manifest}
          patch={draft.patch}
          onPatch={setPatch}
        />
      ),
    },
    {
      id: "advanced",
      label: "Advanced",
      set:
        Object.keys(draft.patch).some(
          (key) => key !== "eventTicket" && key !== "semantics",
        ) ||
        draft.assets.length > 0 ||
        draft.localizations.length > 0 ||
        draft.personalization !== null,
      content: (
        <AdvancedTab
          draft={draft}
          manifest={manifest}
          onDraft={setDraft}
          onPatch={setPatch}
        />
      ),
    },
    {
      id: "json",
      label: "JSON",
      content: (
        <JsonTab
          manifest={manifest}
          composed={composed}
          composing={composing}
          onApply={(next) =>
            setDraft((current) => ({ ...current, patch: fullPatch(next) }))
          }
        />
      ),
    },
  ];

  return (
    <div className="dark text-foreground min-w-0">
      <SourceBar
        draft={draft}
        defaults={defaults}
        real={composed?.context.real ?? false}
        onSource={(source) => setDraft(blankDraft(source))}
        onLevel={(code) =>
          setDraft((current) =>
            current.source.kind === "ticket"
              ? current
              : { ...current, source: { ...current.source, level: code } },
          )
        }
        status={
          <span className="border-input bg-input/20 flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
            <span className={`size-2 rounded-full ${certificateDot}`} />
            {certificateStatus}
          </span>
        }
        reset={
          <Button
            type="button"
            variant="outline"
            disabled={!changed}
            onClick={() => setDraft(blankDraft(draft.source))}
          >
            <RotateCcw />
            Reset changes
          </Button>
        }
      />

      {defaults && !signingReady ? (
        <div className="mt-4 rounded-md border border-amber-500/35 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
          {configured
            ? "The Apple Wallet certificate has expired. You can design the pass, but download and email stay disabled until it is replaced."
            : "Apple Wallet signing variables are missing. You can design the pass, but nothing can be validated, downloaded or emailed until the certificate is configured."}
        </div>
      ) : null}

      <div className="mt-6">
        <PassDesignField
          value={draft.design}
          onChange={(design) => setDraft((current) => ({ ...current, design }))}
          inherits={layers}
          eventName={composed?.context.eventName ?? ""}
          venueAddress={composed?.context.venueAddress ?? null}
          chip={chip}
          intensity={level?.intensity ?? 0}
          showChipControl
          content={
            composed ? previewContent(manifest, composed.context) : undefined
          }
          extraTabs={extraTabs}
        />
      </div>

      <div className="border-border sticky bottom-0 z-20 -mx-4 mt-6 border-t bg-black px-4 py-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Label htmlFor="wallet-pass-recipient">Email recipient</Label>
            <Input
              id="wallet-pass-recipient"
              type="email"
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              placeholder="name@example.com"
              className="mt-1.5"
            />
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!signingReady || pending !== null || composing}
              onClick={() => void submit("download")}
            >
              <Download />
              {pending === "download" ? "Building…" : "Download .pkpass"}
            </Button>
            <Button
              type="button"
              disabled={
                !signingReady ||
                pending !== null ||
                composing ||
                !recipient.trim()
              }
              onClick={() => void submit("send")}
            >
              <Mail />
              {pending === "send" ? "Sending…" : "Sign and send"}
            </Button>
          </div>
        </div>
        <p className="mx-auto mt-2 max-w-7xl text-xs">
          <BundleStatus
            composed={composed}
            composing={composing}
            error={composeError}
          />
        </p>
      </div>
    </div>
  );
}

/** One line on what would be signed: valid or not, how many keys, how big. */
function BundleStatus({
  composed,
  composing,
  error,
}: {
  composed: WalletPassDebugComposeResponse | null;
  composing: boolean;
  error: string | null;
}) {
  if (error) return <span className="text-destructive">{error}</span>;
  if (!composed) {
    return <span className="text-muted-foreground">Composing…</span>;
  }
  const bytes = composed.files.reduce((sum, file) => sum + file.bytes, 0);
  const size = `${composed.files.length} files · ${formatBytes(bytes)}`;
  if (composed.validation === null) {
    return (
      <span className="text-muted-foreground">
        {composing ? "Composing… " : ""}Not validated, signing is not configured
        · {size}
      </span>
    );
  }
  if (!composed.validation.ok) {
    return (
      <span className="text-destructive">{composed.validation.error}</span>
    );
  }
  return (
    <span className="text-muted-foreground">
      {composing ? (
        "Composing…"
      ) : (
        <>
          <span className="text-emerald-400">Valid</span> pass.json
        </>
      )}{" "}
      · {composed.validation.keys} keys · {size}. Nothing on this page is saved;
      the pass is signed only when you download or send it.
    </span>
  );
}

function SourceBar({
  draft,
  defaults,
  real,
  onSource,
  onLevel,
  status,
  reset,
}: {
  draft: WalletPassDebugDraft;
  defaults: WalletPassDebugDefaultsResponse | null;
  real: boolean;
  onSource: (source: WalletPassSource) => void;
  onLevel: (code: string) => void;
  status: ReactNode;
  reset: ReactNode;
}) {
  const { source } = draft;
  const [ticketNumber, setTicketNumber] = useState(
    source.kind === "ticket" ? source.ticketNumber : "",
  );
  const levelCode =
    source.kind === "ticket" ? null : (source.level ?? "GENERAL");

  return (
    <div className="border-border grid gap-4 border-y py-4 md:grid-cols-[200px_1fr_1fr_auto_auto] md:items-end">
      <div>
        <Label>Start from</Label>
        <Select
          value={source.kind}
          onValueChange={(kind) => {
            if (kind === "standalone") onSource({ kind: "standalone" });
            else if (kind === "event") {
              const first = defaults?.events[0];
              if (!first) {
                toast.error("There are no ticketed events to start from.");
                return;
              }
              onSource({ kind: "event", eventId: first.id });
            } else if (ticketNumber.trim()) {
              onSource({ kind: "ticket", ticketNumber: ticketNumber.trim() });
            } else {
              toast.error("Type a ticket number first.");
            }
          }}
        >
          <SelectTrigger className="mt-1.5 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="standalone">A sample night</SelectItem>
            <SelectItem value="event">An event</SelectItem>
            <SelectItem value="ticket">A real ticket</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {source.kind === "event" ? (
        <div className="min-w-0">
          <Label>Event</Label>
          <Select
            value={source.eventId}
            onValueChange={(eventId) =>
              onSource({ kind: "event", eventId, level: source.level })
            }
          >
            <SelectTrigger className="mt-1.5 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {defaults?.events.map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.name}
                  <span className="text-muted-foreground ml-2 text-xs">
                    {new Date(event.startsAt).toLocaleDateString("en-NZ", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : source.kind === "ticket" ? (
        <div className="min-w-0">
          <Label htmlFor="debug-ticket-number">Ticket number</Label>
          <div className="mt-1.5 flex gap-2">
            <Input
              id="debug-ticket-number"
              value={ticketNumber}
              onChange={(event) =>
                setTicketNumber(event.target.value.toUpperCase())
              }
              onKeyDown={(event) => {
                if (event.key === "Enter" && ticketNumber.trim()) {
                  event.preventDefault();
                  onSource({
                    kind: "ticket",
                    ticketNumber: ticketNumber.trim(),
                  });
                }
              }}
              placeholder="ATN-00000"
              className="font-mono"
            />
            <Button
              type="button"
              variant="outline"
              disabled={!ticketNumber.trim()}
              onClick={() =>
                onSource({ kind: "ticket", ticketNumber: ticketNumber.trim() })
              }
            >
              Load
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-muted-foreground self-center text-sm md:pb-2">
          A sample ticket to a sample night, in house style.
        </div>
      )}

      {levelCode !== null ? (
        <div>
          <Label>Level</Label>
          <Select value={levelCode} onValueChange={onLevel}>
            <SelectTrigger className="mt-1.5 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(defaults?.levels ?? []).map((item) => (
                <SelectItem key={item.code} value={item.code}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="self-center text-sm text-amber-200 md:pb-2">
          {real
            ? "This is the holder's real pass and QR. Send it only to yourself."
            : "Load a ticket by its number."}
        </div>
      )}

      <div>
        <Label>Signing</Label>
        <div className="mt-1.5">{status}</div>
      </div>
      {reset}
    </div>
  );
}

/** Pretty label with an optional hint on the right, the debugger's own. */
function FieldHead({
  children,
  hint,
  htmlFor,
}: {
  children: ReactNode;
  hint?: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-3">
      {htmlFor ? (
        <Label htmlFor={htmlFor}>{children}</Label>
      ) : (
        <p className="text-sm leading-none font-medium">{children}</p>
      )}
      {hint ? (
        <span className="text-muted-foreground text-xs">{hint}</span>
      ) : null}
    </div>
  );
}

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-border border-t py-6 first:border-t-0 first:pt-0">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description ? (
            <p className="text-muted-foreground mt-0.5 text-xs">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A JSON box that commits on blur, for the keys with no better editor. */
function JsonBox({
  label,
  hint,
  value,
  empty,
  onChange,
}: {
  label: string;
  hint?: string;
  value: JsonValue | undefined;
  empty: "[]" | "{}";
  onChange: (value: JsonValue | undefined) => void;
}) {
  const source = value === undefined ? empty : prettyJson(value);
  return (
    <div>
      <FieldHead hint={hint}>{label}</FieldHead>
      <Textarea
        aria-label={label}
        key={source}
        defaultValue={source}
        spellCheck={false}
        className="min-h-24 resize-y font-mono text-xs leading-relaxed"
        onBlur={(event) => {
          const text = event.currentTarget.value;
          try {
            const parsed: unknown = JSON.parse(text);
            const wrapper = parseJsonObject(
              `{"value":${JSON.stringify(parsed)}}`,
            );
            const next = wrapper.value;
            onChange(
              (Array.isArray(next) && next.length === 0) ||
                (isJsonObject(next) && Object.keys(next).length === 0)
                ? undefined
                : next,
            );
          } catch {
            toast.error(`${label} must be valid JSON.`);
            event.currentTarget.value = source;
          }
        }}
      />
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Fields                                                                  */
/* ----------------------------------------------------------------------- */

const SLOT_HINTS: Record<PassFieldSlot, string> = {
  headerFields: "Beside the logo. One or two at most.",
  primaryFields: "The big one. Empty when the band carries the name.",
  secondaryFields: "The first row under the band.",
  auxiliaryFields: "The second row; row 1 is a third, on event tickets.",
  additionalInfoFields: "A poster pass's details section. iOS 18.",
  backFields: "The back. Links, numbers and addresses become tappable.",
};

function FieldsTab({
  manifest,
  patch,
  onPatch,
}: {
  manifest: JsonObject;
  patch: Patch;
  onPatch: (update: (patch: Patch) => Patch) => void;
}) {
  const patched = (slot: PassFieldSlot) =>
    isJsonObject(patch.eventTicket) && Array.isArray(patch.eventTicket[slot]);
  const replace = (slot: PassFieldSlot, fields: JsonObject[]) =>
    onPatch((current) => ({
      ...current,
      eventTicket: {
        ...(isJsonObject(current.eventTicket) ? current.eventTicket : {}),
        [slot]: fields,
      },
    }));
  const follow = (slot: PassFieldSlot) =>
    onPatch((current) => {
      const ticket = isJsonObject(current.eventTicket)
        ? { ...current.eventTicket }
        : {};
      delete ticket[slot];
      const next = { ...current };
      if (Object.keys(ticket).length > 0) next.eventTicket = ticket;
      else delete next.eventTicket;
      return next;
    });

  return (
    <>
      {PASS_FIELD_SLOTS.map((slot) => {
        const fields = fieldsOf(manifest, slot);
        const own = patched(slot);
        const update = (index: number, field: JsonObject) =>
          replace(
            slot,
            fields.map((item, i) => (i === index ? field : item)),
          );
        return (
          <Section
            key={slot}
            title={`${PASS_FIELD_SLOT_LABELS[slot]} fields`}
            description={SLOT_HINTS[slot]}
            action={
              own ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => follow(slot)}
                >
                  Follow the source
                </Button>
              ) : (
                <span className="text-muted-foreground text-xs">
                  From the source
                </span>
              )
            }
          >
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div
                  key={`${textOf(field.key)}-${index}`}
                  className="border-border rounded-lg border p-3"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <Input
                      aria-label="Key"
                      value={textOf(field.key)}
                      onChange={(event) =>
                        update(index, { ...field, key: event.target.value })
                      }
                      className="h-8 w-40 font-mono text-xs"
                    />
                    <div className="flex gap-1">
                      {slot === "auxiliaryFields" && (
                        <Select
                          value={field.row === 1 ? "1" : "0"}
                          onValueChange={(row) =>
                            update(
                              index,
                              row === "1"
                                ? { ...field, row: 1 }
                                : Object.fromEntries(
                                    Object.entries(field).filter(
                                      ([key]) => key !== "row",
                                    ),
                                  ),
                            )
                          }
                        >
                          <SelectTrigger className="h-8 w-24 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Row 0</SelectItem>
                            <SelectItem value="1">Row 1</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Move field up"
                        disabled={index === 0}
                        onClick={() => {
                          const next = [...fields];
                          [next[index - 1], next[index]] = [
                            next[index]!,
                            next[index - 1]!,
                          ];
                          replace(slot, next);
                        }}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Move field down"
                        disabled={index === fields.length - 1}
                        onClick={() => {
                          const next = [...fields];
                          [next[index], next[index + 1]] = [
                            next[index + 1]!,
                            next[index]!,
                          ];
                          replace(slot, next);
                        }}
                      >
                        <ArrowDown />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete field"
                        onClick={() =>
                          replace(
                            slot,
                            fields.filter((_, i) => i !== index),
                          )
                        }
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-[160px_1fr]">
                    <Input
                      aria-label="Label"
                      value={textOf(field.label)}
                      placeholder="LABEL"
                      onChange={(event) =>
                        update(index, { ...field, label: event.target.value })
                      }
                    />
                    <Textarea
                      aria-label="Value"
                      value={textOf(field.value)}
                      rows={1}
                      onChange={(event) =>
                        update(index, { ...field, value: event.target.value })
                      }
                      className="min-h-9"
                    />
                    {slot !== "backFields" && (
                      <>
                        <span className="text-muted-foreground self-center text-xs">
                          Change message
                        </span>
                        <Input
                          aria-label="Change message"
                          value={textOf(field.changeMessage)}
                          placeholder="Doors now %@"
                          onChange={(event) => {
                            const next = { ...field };
                            if (event.target.value) {
                              next.changeMessage = event.target.value;
                            } else {
                              delete next.changeMessage;
                            }
                            update(index, next);
                          }}
                        />
                      </>
                    )}
                  </div>
                  <details className="mt-2">
                    <summary className="text-muted-foreground cursor-pointer text-xs">
                      Everything else on this field
                    </summary>
                    <div className="mt-2">
                      <JsonBox
                        label="Other properties"
                        hint="attributedValue, dateStyle, textAlignment, dataDetectorTypes, semantics"
                        value={Object.fromEntries(
                          Object.entries(field).filter(
                            ([key]) =>
                              ![
                                "key",
                                "label",
                                "value",
                                "changeMessage",
                                "row",
                              ].includes(key),
                          ),
                        )}
                        empty="{}"
                        onChange={(value) => {
                          const kept = Object.fromEntries(
                            Object.entries(field).filter(([key]) =>
                              [
                                "key",
                                "label",
                                "value",
                                "changeMessage",
                                "row",
                              ].includes(key),
                            ),
                          );
                          update(index, {
                            ...(isJsonObject(value) ? value : {}),
                            ...kept,
                          });
                        }}
                      />
                    </div>
                  </details>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() =>
                replace(slot, [
                  ...fields,
                  {
                    key: `field-${crypto.randomUUID().slice(0, 8)}`,
                    label: "LABEL",
                    value: "Value",
                  },
                ])
              }
            >
              <Plus />
              Add {PASS_FIELD_SLOT_LABELS[slot].toLowerCase()} field
            </Button>
          </Section>
        );
      })}
    </>
  );
}

/* ----------------------------------------------------------------------- */
/* Semantics                                                               */
/* ----------------------------------------------------------------------- */

const EVENT_TYPES = [
  ["PKEventTypeLivePerformance", "Live performance"],
  ["PKEventTypeGeneric", "Generic"],
  ["PKEventTypeMovie", "Movie"],
  ["PKEventTypeConference", "Conference"],
  ["PKEventTypeConvention", "Convention"],
  ["PKEventTypeWorkshop", "Workshop"],
  ["PKEventTypeSocialGathering", "Social gathering"],
  ["PKEventTypeSports", "Sports"],
] as const;

const SEMANTIC_TEXT = [
  ["eventName", "Event name"],
  ["venueName", "Venue"],
  ["venueRegionName", "Region"],
  ["venueEntrance", "Entrance"],
  ["admissionLevel", "Admission level"],
  ["admissionLevelAbbreviation", "Admission, short"],
  ["attendeeName", "Attendee"],
  ["entranceDescription", "Entrance description"],
] as const;

const SEMANTIC_DATES = [
  ["eventStartDate", "Starts"],
  ["eventEndDate", "Ends"],
  ["venueDoorsOpenDate", "Doors"],
  ["venueGatesOpenDate", "Gates"],
  ["venueCloseDate", "Venue closes"],
] as const;

const SEMANTIC_KNOWN = new Set<string>([
  "eventType",
  "performerNames",
  ...SEMANTIC_TEXT.map(([key]) => key),
  ...SEMANTIC_DATES.map(([key]) => key),
]);

function SemanticsTab({
  manifest,
  patch,
  onPatch,
}: {
  manifest: JsonObject;
  patch: Patch;
  onPatch: (update: (patch: Patch) => Patch) => void;
}) {
  const semantics = semanticsOf(manifest);
  const set = (key: string, value: JsonValue | undefined) =>
    onPatch((current) => ({
      ...current,
      semantics: {
        ...(isJsonObject(current.semantics) ? current.semantics : {}),
        // Null removes the key from the composed pass; see `applyPatch`.
        [key]: value === undefined || value === "" ? null : value,
      },
    }));
  const own = isJsonObject(patch.semantics);
  const rest = Object.fromEntries(
    Object.entries(semantics).filter(([key]) => !SEMANTIC_KNOWN.has(key)),
  );
  const performers = Array.isArray(semantics.performerNames)
    ? semantics.performerNames.map(textOf).join(", ")
    : "";

  return (
    <>
      <Section
        title="What the pass means"
        description="Siri, Focus and the poster layout read these. The source fills them in; anything you change here is yours."
        action={
          own ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                onPatch((current) => {
                  const next = { ...current };
                  delete next.semantics;
                  return next;
                })
              }
            >
              Follow the source
            </Button>
          ) : null
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <FieldHead>Event type</FieldHead>
            <Select
              value={
                textOf(semantics.eventType) || "PKEventTypeLivePerformance"
              }
              onValueChange={(value) => set("eventType", value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <FieldHead htmlFor="semantic-performers" hint="Comma separated">
              Performers
            </FieldHead>
            <Input
              id="semantic-performers"
              key={performers}
              defaultValue={performers}
              onBlur={(event) => {
                const names = event.target.value
                  .split(",")
                  .map((name) => name.trim())
                  .filter(Boolean);
                set("performerNames", names.length > 0 ? names : undefined);
              }}
            />
          </div>
          {SEMANTIC_TEXT.map(([key, label]) => (
            <div key={key}>
              <FieldHead htmlFor={`semantic-${key}`}>{label}</FieldHead>
              <Input
                id={`semantic-${key}`}
                key={textOf(semantics[key])}
                defaultValue={textOf(semantics[key])}
                onBlur={(event) => {
                  if (event.target.value !== textOf(semantics[key])) {
                    set(key, event.target.value);
                  }
                }}
              />
            </div>
          ))}
          {SEMANTIC_DATES.map(([key, label]) => (
            <div key={key}>
              <FieldHead htmlFor={`semantic-${key}`} hint="Local time">
                {label}
              </FieldHead>
              <Input
                id={`semantic-${key}`}
                type="datetime-local"
                value={toLocalInput(textOf(semantics[key]))}
                onChange={(event) =>
                  set(key, fromLocalInput(event.target.value))
                }
              />
            </div>
          ))}
        </div>
      </Section>
      <Section
        title="Everything else"
        description="Seats, location, teams, sports and the rest, as JSON. Merged with the above."
      >
        <JsonBox
          label="Other semantic tags"
          value={Object.keys(rest).length > 0 ? rest : undefined}
          empty="{}"
          onChange={(value) =>
            onPatch((current) => {
              const removed = Object.fromEntries(
                Object.keys(rest).map((key) => [key, null]),
              );
              return {
                ...current,
                semantics: {
                  ...(isJsonObject(current.semantics) ? current.semantics : {}),
                  ...removed,
                  ...(isJsonObject(value) ? value : {}),
                },
              };
            })
          }
        />
      </Section>
    </>
  );
}

/* ----------------------------------------------------------------------- */
/* Advanced                                                                */
/* ----------------------------------------------------------------------- */

function AdvancedTab({
  draft,
  manifest,
  onDraft,
  onPatch,
}: {
  draft: WalletPassDebugDraft;
  manifest: JsonObject;
  onDraft: (
    update: (draft: WalletPassDebugDraft) => WalletPassDebugDraft,
  ) => void;
  onPatch: (update: (patch: Patch) => Patch) => void;
}) {
  const setKey = (key: string, value: JsonValue | undefined) =>
    onPatch((current) => {
      const next = { ...current };
      if (value === undefined || value === "") delete next[key];
      else next[key] = value;
      return next;
    });
  const text = (
    key: string,
    label: string,
    options: { mono?: boolean; hint?: string } = {},
  ) => (
    <div key={key} className="min-w-0">
      <FieldHead htmlFor={`manifest-${key}`} hint={options.hint}>
        {label}
      </FieldHead>
      <Input
        id={`manifest-${key}`}
        key={textOf(manifest[key])}
        defaultValue={textOf(manifest[key])}
        spellCheck={!options.mono}
        className={options.mono ? "font-mono text-xs" : ""}
        onBlur={(event) => {
          if (event.target.value !== textOf(manifest[key])) {
            setKey(key, event.target.value);
          }
        }}
      />
    </div>
  );
  const date = (key: string, label: string, hint?: string) => (
    <div key={key}>
      <FieldHead htmlFor={`manifest-${key}`} hint={hint}>
        {label}
      </FieldHead>
      <Input
        id={`manifest-${key}`}
        type="datetime-local"
        value={toLocalInput(textOf(manifest[key]))}
        onChange={(event) =>
          setKey(key, fromLocalInput(event.target.value) ?? null)
        }
      />
    </div>
  );
  const flag = (key: string, label: string, hint: string) => (
    <div
      key={key}
      className="border-border flex items-center justify-between gap-5 border-b py-3 last:border-0"
    >
      <div>
        <Label htmlFor={`manifest-${key}`}>{label}</Label>
        <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>
      </div>
      <Switch
        id={`manifest-${key}`}
        checked={manifest[key] === true}
        onCheckedChange={(checked) => setKey(key, checked ? true : null)}
      />
    </div>
  );

  const interval = Array.isArray(manifest.relevantDates)
    ? manifest.relevantDates.find(isJsonObject)
    : undefined;
  const setInterval = (start: string | undefined, end: string | undefined) =>
    setKey(
      "relevantDates",
      start && end
        ? [{ startDate: start, endDate: end }]
        : start
          ? [{ date: start, relevantDate: start }]
          : null,
    );

  const addAssets = async (files: File[]) => {
    try {
      const assets = await Promise.all(files.map(fileAsAsset));
      onDraft((current) => {
        const byName = new Map(
          [...current.assets, ...assets].map((asset) => [
            asset.fileName,
            asset,
          ]),
        );
        const next = { ...current, assets: [...byName.values()] };
        const result = walletPassDebugDraftSchema.safeParse(next);
        if (!result.success) {
          toast.error(result.error.issues[0]?.message ?? "Bad asset.");
          return current;
        }
        return result.data;
      });
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Could not add asset.",
      );
    }
  };

  return (
    <>
      <Section
        title="Identity"
        description="Who the pass says it is from. Defaults to the signing configuration."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {text("organizationName", "Organisation")}
          {text("description", "Description", {
            hint: "Read out by VoiceOver",
          })}
          {text("passTypeIdentifier", "Pass type identifier", { mono: true })}
          {text("teamIdentifier", "Team identifier", { mono: true })}
          {text("serialNumber", "Serial number", { mono: true })}
          {text("groupingIdentifier", "Grouping identifier", {
            mono: true,
            hint: "Passes that share it stack",
          })}
        </div>
      </Section>

      <Section
        title="Dates"
        description="When the pass offers itself and when it expires. An interval is a live activity on a poster pass."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {date("relevantDate", "Relevant date", "Phones before iOS 18")}
          {date("expirationDate", "Expires")}
          <div>
            <FieldHead htmlFor="manifest-relevantFrom">Relevant from</FieldHead>
            <Input
              id="manifest-relevantFrom"
              type="datetime-local"
              value={toLocalInput(
                textOf(interval?.startDate) ||
                  textOf(interval?.date) ||
                  textOf(interval?.relevantDate),
              )}
              onChange={(event) =>
                setInterval(
                  fromLocalInput(event.target.value),
                  textOf(interval?.endDate) || undefined,
                )
              }
            />
          </div>
          <div>
            <FieldHead htmlFor="manifest-relevantUntil" hint="At most 24 hours">
              Until
            </FieldHead>
            <Input
              id="manifest-relevantUntil"
              type="datetime-local"
              value={toLocalInput(textOf(interval?.endDate))}
              onChange={(event) =>
                setInterval(
                  textOf(interval?.startDate) ||
                    textOf(interval?.date) ||
                    undefined,
                  fromLocalInput(event.target.value),
                )
              }
            />
          </div>
        </div>
      </Section>

      <Section
        title="Behaviour"
        description="Switches Wallet reads straight off the pass."
      >
        {flag("voided", "Voided", "Greyed out and off the lock screen.")}
        {flag(
          "sharingProhibited",
          "Sharing prohibited",
          "Removes the Share button on the back.",
        )}
        {flag(
          "suppressStripShine",
          "Suppress strip shine",
          "Turns off the gloss older iOS draws over a band.",
        )}
      </Section>

      <Section
        title="Web service and app"
        description="A sample pass is not registered for updates, so these stay empty unless the source is a real ticket."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {text("webServiceURL", "Web service URL", { mono: true })}
          {text("authenticationToken", "Authentication token", { mono: true })}
          {text("appLaunchURL", "App launch URL", { mono: true })}
          <div>
            <FieldHead
              htmlFor="manifest-stores"
              hint="Comma separated App Store ids"
            >
              Associated apps
            </FieldHead>
            <Input
              id="manifest-stores"
              key={
                Array.isArray(manifest.associatedStoreIdentifiers)
                  ? manifest.associatedStoreIdentifiers.map(textOf).join(", ")
                  : ""
              }
              defaultValue={
                Array.isArray(manifest.associatedStoreIdentifiers)
                  ? manifest.associatedStoreIdentifiers.map(textOf).join(", ")
                  : ""
              }
              className="font-mono text-xs"
              onBlur={(event) => {
                const ids = event.target.value
                  .split(",")
                  .map((value) => Number(value.trim()))
                  .filter((value) => Number.isInteger(value) && value > 0);
                setKey("associatedStoreIdentifiers", ids.length ? ids : null);
              }}
            />
          </div>
        </div>
      </Section>

      <Section
        title="Raw keys"
        description="Beacons, NFC and the rest, as JSON. Empty follows the source."
      >
        <div className="grid gap-5 md:grid-cols-2">
          {[
            [
              "beacons",
              "Beacons",
              "proximityUUID, major, minor, relevantText",
              "[]",
            ],
            ["nfc", "NFC", "message, encryptionPublicKey", "{}"],
            ["userInfo", "User info", "For the app, never shown", "{}"],
            ["upcomingPassInformation", "Upcoming passes", "iOS 26", "[]"],
          ].map(([key, label, hint, empty]) => (
            <JsonBox
              key={key}
              label={label!}
              hint={hint}
              value={manifest[key!]}
              empty={empty as "[]" | "{}"}
              onChange={(value) => setKey(key!, value ?? null)}
            />
          ))}
          <JsonBox
            label="Personalization"
            hint="Needs NFC and a personalizationLogo"
            value={draft.personalization ?? undefined}
            empty="{}"
            onChange={(value) =>
              onDraft((current) => ({
                ...current,
                personalization: isJsonObject(value) ? value : null,
              }))
            }
          />
        </div>
      </Section>

      <Section
        title="Files by name"
        description="A PNG here replaces the generated one with the same name. For the odd case the Look tab cannot reach."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <label className="cursor-pointer">
              <Upload className="size-4" />
              Add PNG files
              <input
                type="file"
                accept="image/png"
                multiple
                className="sr-only"
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  void addAssets(files);
                }}
              />
            </label>
          </Button>
          <span className="text-muted-foreground text-xs">
            Keep Apple&apos;s names: logo@2x.png, background@3x.png,
            en.lproj/thumbnail.png.
          </span>
        </div>
        {draft.assets.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {draft.assets.map((asset) => (
              <Button
                key={asset.fileName}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  onDraft((current) => ({
                    ...current,
                    assets: current.assets.filter(
                      (item) => item.fileName !== asset.fileName,
                    ),
                  }))
                }
              >
                {asset.fileName}
                <Trash2 className="size-3.5" />
              </Button>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Locales"
        description="Each becomes a .lproj/pass.strings file. Keys must match strings used in pass.json."
      >
        <div className="space-y-3">
          {draft.localizations.map((locale, index) => (
            <div key={index} className="border-border rounded-lg border p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <Input
                  aria-label="Language"
                  value={locale.language}
                  onChange={(event) =>
                    onDraft((current) => ({
                      ...current,
                      localizations: current.localizations.map((item, i) =>
                        i === index
                          ? { ...item, language: event.target.value }
                          : item,
                      ),
                    }))
                  }
                  className="h-8 w-32 font-mono text-xs"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete locale"
                  onClick={() =>
                    onDraft((current) => ({
                      ...current,
                      localizations: current.localizations.filter(
                        (_, i) => i !== index,
                      ),
                    }))
                  }
                >
                  <Trash2 />
                </Button>
              </div>
              <JsonBox
                label="Translations"
                value={locale.translations}
                empty="{}"
                onChange={(value) =>
                  onDraft((current) => ({
                    ...current,
                    localizations: current.localizations.map((item, i) =>
                      i === index
                        ? {
                            ...item,
                            translations: isJsonObject(value)
                              ? Object.fromEntries(
                                  Object.entries(value).filter(
                                    (entry): entry is [string, string] =>
                                      typeof entry[1] === "string",
                                  ),
                                )
                              : {},
                          }
                        : item,
                    ),
                  }))
                }
              />
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() =>
            onDraft((current) => ({
              ...current,
              localizations: [
                ...current.localizations,
                { language: "en", translations: {} },
              ],
            }))
          }
        >
          <Plus />
          Add locale
        </Button>
      </Section>
    </>
  );
}

/* ----------------------------------------------------------------------- */
/* JSON                                                                    */
/* ----------------------------------------------------------------------- */

/**
 * A whole pass.json as a patch: every key becomes the organiser's, slots the
 * JSON left out are emptied and semantics it left out are dropped, so what
 * was applied is exactly what shows.
 */
function fullPatch(manifest: JsonObject): Patch {
  const ticket = isJsonObject(manifest.eventTicket) ? manifest.eventTicket : {};
  return {
    ...manifest,
    eventTicket: {
      ...Object.fromEntries(PASS_FIELD_SLOTS.map((slot) => [slot, []])),
      ...ticket,
    },
    semantics: isJsonObject(manifest.semantics) ? manifest.semantics : null,
  };
}

function JsonTab({
  manifest,
  composed,
  composing,
  onApply,
}: {
  manifest: JsonObject;
  composed: WalletPassDebugComposeResponse | null;
  composing: boolean;
  onApply: (manifest: JsonObject) => void;
}) {
  const source = prettyJson(manifest);
  const area = useRef<HTMLTextAreaElement>(null);
  return (
    <>
      <Section
        title="Complete pass.json"
        description="What is validated, bundled and signed. Apply to take the whole thing over; Reset changes to follow the source again."
      >
        <Textarea
          aria-label="Complete pass.json"
          key={source}
          ref={area}
          defaultValue={source}
          spellCheck={false}
          className="min-h-[480px] resize-y font-mono text-xs leading-relaxed"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-xs">
            Keys the pass library does not know are rejected when it validates.
          </p>
          <Button
            type="button"
            disabled={composing}
            onClick={() => {
              try {
                onApply(parseJsonObject(area.current?.value ?? source));
                toast.success("pass.json applied");
              } catch (cause) {
                toast.error(
                  cause instanceof Error
                    ? cause.message
                    : "pass.json must be valid JSON.",
                );
              }
            }}
          >
            Apply JSON
          </Button>
        </div>
      </Section>
      <Section
        title="Bundle"
        description="The files that would be zipped and signed, with their sizes."
      >
        {composed ? (
          <div className="border-border divide-border divide-y rounded-md border">
            {composed.files.map((file) => (
              <div
                key={file.name}
                className="flex items-center justify-between gap-4 px-3 py-2 text-xs"
              >
                <span className="truncate font-mono">{file.name}</span>
                <span className="text-muted-foreground shrink-0">
                  {formatBytes(file.bytes)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-xs">Composing…</p>
        )}
      </Section>
    </>
  );
}
