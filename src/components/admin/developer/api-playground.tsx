"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";

import { api } from "~/trpc/react";
import {
  operationsOf,
  type OpenApiParameter,
  type SpecOperation,
} from "~/lib/developer/openapi";
import { hasScope, scopesToPermissions } from "~/lib/developer/scopes";
import {
  exampleBody,
  fillPath,
  operationKey,
  snippet,
} from "~/lib/developer/snippets";
import {
  API_UPDATE_TYPE_NAMES,
  API_UPDATE_TYPES,
  type ApiUpdateType,
} from "~/lib/developer/updates";
import { CopyButton } from "~/components/admin/short-links/copy-button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import { Textarea } from "~/components/ui/textarea";
import { Block, Method, ScopeBadge } from "./api-docs-parts";
import {
  callApi,
  KeyDialog,
  type ApiCall,
  type PlaygroundKey,
} from "./playground-key";

/**
 * Try the developer API from the admin, with a real key against the real
 * site, so scopes, limits and errors behave exactly as they will for an
 * integration. Two modes: build and send requests, or watch the update feed
 * arrive.
 */
export function ApiPlayground({
  operationKey: requested,
}: {
  /** Set when "Try it" on the reference picked an endpoint. */
  operationKey: string | null;
}) {
  const spec = api.developer.spec.useQuery(undefined, {
    staleTime: Infinity,
  });
  const [key, setKey] = useState<PlaygroundKey | null>(null);
  const [choosingKey, setChoosingKey] = useState(false);
  const [mode, setMode] = useState<"requests" | "updates">("requests");
  const [calls, setCalls] = useState<ApiCall[]>([]);

  const operations = useMemo(
    () => (spec.data ? operationsOf(spec.data) : []),
    [spec.data],
  );

  if (!spec.data) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <ModeButton
          on={mode === "requests"}
          onClick={() => setMode("requests")}
        >
          Requests
        </ModeButton>
        <ModeButton on={mode === "updates"} onClick={() => setMode("updates")}>
          Updates
        </ModeButton>
        <span className="flex-1" />
        <KeySummary playgroundKey={key} />
        <Button
          size="sm"
          variant="outline"
          onClick={() => setChoosingKey(true)}
        >
          {key ? "Change key" : "Get a key"}
        </Button>
      </div>

      {mode === "requests" ? (
        <Requests
          // "Try it" on the reference starts it over on that endpoint.
          key={requested ?? "first"}
          calls={calls}
          onCall={(call) =>
            setCalls((current) => [call, ...current].slice(0, 20))
          }
          operations={operations}
          base={spec.data.servers[0].url}
          playgroundKey={key}
          requested={requested}
          onNeedKey={() => setChoosingKey(true)}
        />
      ) : (
        <Updates playgroundKey={key} onNeedKey={() => setChoosingKey(true)} />
      )}

      <KeyDialog
        open={choosingKey}
        onOpenChange={setChoosingKey}
        onKey={setKey}
      />
    </div>
  );
}

function ModeButton({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-md px-3 py-1 text-sm ${
        on
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function KeySummary({
  playgroundKey,
}: {
  playgroundKey: PlaygroundKey | null;
}) {
  if (!playgroundKey) {
    return <span className="text-muted-foreground text-xs">No key yet</span>;
  }
  const { name, scopes, expiresAt } = playgroundKey;
  return (
    <span className="text-muted-foreground min-w-0 truncate text-xs">
      {name}
      {expiresAt && expiresAt > new Date()
        ? `, ${formatDistanceToNowStrict(expiresAt)} left`
        : expiresAt
          ? ", expired"
          : ""}
      {" · "}
      {scopes.length} {scopes.length === 1 ? "scope" : "scopes"}
    </span>
  );
}

// ------------------------------------------------------------------ requests

type CallLog = { calls: ApiCall[]; onCall: (call: ApiCall) => void };

function Requests({
  operations,
  base,
  playgroundKey,
  requested,
  onNeedKey,
  calls,
  onCall,
}: {
  operations: SpecOperation[];
  base: string;
  playgroundKey: PlaygroundKey | null;
  requested: string | null;
  onNeedKey: () => void;
} & CallLog) {
  const [selected, setSelected] = useState(
    requested ?? operationKey(operations[0]!),
  );
  const operation =
    operations.find((op) => operationKey(op) === selected) ?? operations[0]!;

  return (
    <RequestBuilder
      // A fresh form per endpoint: its params and body start from its example.
      key={operationKey(operation)}
      operations={operations}
      operation={operation}
      onSelect={setSelected}
      base={base}
      playgroundKey={playgroundKey}
      onNeedKey={onNeedKey}
      calls={calls}
      onCall={onCall}
    />
  );
}

function RequestBuilder({
  operations,
  operation,
  onSelect,
  base,
  playgroundKey,
  onNeedKey,
  calls,
  onCall,
}: {
  operations: SpecOperation[];
  operation: SpecOperation;
  onSelect: (key: string) => void;
  base: string;
  playgroundKey: PlaygroundKey | null;
  onNeedKey: () => void;
} & CallLog) {
  const pathParams = operation.parameters.filter((p) => p.in === "path");
  const queryParams = operation.parameters.filter((p) => p.in === "query");
  const starting = exampleBody(operation);

  const [params, setParams] = useState<Record<string, string>>({});
  const [query, setQuery] = useState<Record<string, string>>({});
  const [body, setBody] = useState(
    starting === undefined ? "" : JSON.stringify(starting, null, 2),
  );
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [shown, setShown] = useState(0);

  const path = fillPath(operation.path, params, query);
  const bodyError = useMemo(() => {
    if (!operation.requestBody || !body.trim()) return null;
    try {
      JSON.parse(body);
      return null;
    } catch {
      return "Not valid JSON";
    }
  }, [operation.requestBody, body]);
  const parsedBody: unknown =
    operation.requestBody && body.trim() && !bodyError
      ? JSON.parse(body)
      : undefined;

  const curl = snippet("curl", {
    base,
    method: operation.method,
    path,
    body: parsedBody,
  });

  const missingScopes = playgroundKey
    ? operation["x-scopes"].filter(
        (scope) => !hasScope(scopesToPermissions(playgroundKey.scopes), scope),
      )
    : [];

  async function send() {
    if (!playgroundKey) return onNeedKey();
    setSending(true);
    try {
      const call = await callApi(
        playgroundKey.key,
        operation.method.toUpperCase(),
        path,
        operation.requestBody ? body || "{}" : undefined,
      );
      onCall(call);
      setShown(0);
    } finally {
      setSending(false);
    }
  }

  const call = calls[shown];

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="min-w-0 space-y-4">
        <div className="flex gap-2">
          <Select value={operationKey(operation)} onValueChange={onSelect}>
            <SelectTrigger className="min-w-0 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {groupByTag(operations).map(([tag, inTag]) => (
                <SelectGroup key={tag}>
                  <SelectLabel>{tag}</SelectLabel>
                  {inTag.map((op) => (
                    <SelectItem key={operationKey(op)} value={operationKey(op)}>
                      <Method method={op.method} short />
                      <span className="font-mono text-xs">{op.path}</span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <Button
            disabled={sending || bodyError !== null}
            onClick={() =>
              operation.method === "get" ? void send() : setConfirming(true)
            }
          >
            {sending ? "Sending…" : "Send"}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">{operation.summary}.</span>
          {operation["x-scopes"].map((scope) => (
            <ScopeBadge key={scope} scope={scope} />
          ))}
          {missingScopes.length > 0 && (
            <span className="text-amber-500">
              This key lacks {missingScopes.join(", ")}
            </span>
          )}
        </div>

        {pathParams.length > 0 && (
          <FieldGroup label="Path">
            {pathParams.map((param) => (
              <ParamField
                key={param.name}
                param={param}
                path={operation.path}
                value={params[param.name] ?? ""}
                onChange={(value) =>
                  setParams((current) => ({ ...current, [param.name]: value }))
                }
              />
            ))}
          </FieldGroup>
        )}

        {queryParams.length > 0 && (
          <FieldGroup label="Query">
            {queryParams.map((param) => (
              <ParamField
                key={param.name}
                param={param}
                path={operation.path}
                value={query[param.name] ?? ""}
                onChange={(value) =>
                  setQuery((current) => ({ ...current, [param.name]: value }))
                }
              />
            ))}
          </FieldGroup>
        )}

        {operation.requestBody && (
          <FieldGroup label="Body">
            <Textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              spellCheck={false}
              className="min-h-48 font-mono text-xs"
            />
            {bodyError && <p className="text-xs text-red-500">{bodyError}</p>}
          </FieldGroup>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground text-xs">As curl</span>
            <CopyButton size="sm" value={curl} />
          </div>
          <Block className="max-h-48">{curl}</Block>
        </div>
      </div>

      <div className="min-w-0 space-y-4">
        {call ? (
          <Response call={call} />
        ) : (
          <div className="text-muted-foreground rounded-md border border-dashed p-6 text-sm">
            {playgroundKey
              ? "Send a request to see what comes back."
              : "Get a key, then send a request to see what comes back."}
          </div>
        )}

        {calls.length > 0 && (
          <FieldGroup label="History">
            <div className="divide-border divide-y rounded-md border font-mono text-xs">
              {calls.map((entry, index) => (
                <button
                  key={`${entry.at.getTime()}-${index}`}
                  type="button"
                  onClick={() => setShown(index)}
                  className={`flex w-full gap-3 px-3 py-1.5 text-left ${
                    index === shown ? "bg-muted" : "hover:bg-muted/50"
                  }`}
                >
                  <StatusText status={entry.status} />
                  <span className="text-muted-foreground">{entry.method}</span>
                  <span className="min-w-0 truncate">{entry.path}</span>
                </button>
              ))}
            </div>
          </FieldGroup>
        )}
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Send {operation.method.toUpperCase()} {path}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This is the real site. {operation.summary} happens for real, as it
              would from the admin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirming(false);
                void send();
              }}
            >
              Send
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function groupByTag(operations: SpecOperation[]) {
  const groups = new Map<string, SpecOperation[]>();
  for (const op of operations) {
    const tag = op.tags[0];
    groups.set(tag, [...(groups.get(tag) ?? []), op]);
  }
  return [...groups.entries()];
}

function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="text-muted-foreground text-xs">{label}</div>
      {children}
    </div>
  );
}

/**
 * One path or query parameter. A gig or event id is picked by name from the
 * latest ones; anything else is typed.
 */
function ParamField({
  param,
  path,
  value,
  onChange,
}: {
  param: OpenApiParameter;
  path: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const picks = api.developer.playgroundIds.useQuery(undefined, {
    staleTime: 60_000,
  });
  const choices =
    param.in === "path" && param.name === "id"
      ? path.startsWith("/gigs/")
        ? picks.data?.gigs
        : path.startsWith("/events/")
          ? picks.data?.events
          : undefined
      : param.name === "gigId"
        ? picks.data?.gigs
        : param.name === "eventId"
          ? picks.data?.events
          : undefined;
  const options = param.schema.enum?.map(String);

  return (
    <div className="grid items-center gap-2 sm:grid-cols-[8rem_1fr]">
      <label className="font-mono text-xs" htmlFor={`param-${param.name}`}>
        {param.name}
        {param.required && (
          <span className="text-muted-foreground ml-1">*</span>
        )}
      </label>
      {choices || options ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger id={`param-${param.name}`} className="min-w-0">
            <SelectValue placeholder={param.description ?? "Pick one"} />
          </SelectTrigger>
          <SelectContent>
            {choices
              ? choices.map((choice) => (
                  <SelectItem key={choice.id} value={choice.id}>
                    {choice.label}
                    <span className="text-muted-foreground text-xs">
                      {choice.at.toLocaleDateString()}
                    </span>
                  </SelectItem>
                ))
              : options?.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={`param-${param.name}`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={
            typeof param.schema.default === "string" ||
            typeof param.schema.default === "number"
              ? String(param.schema.default)
              : (param.description ?? "")
          }
          className="font-mono text-xs"
        />
      )}
    </div>
  );
}

function Response({ call }: { call: ApiCall }) {
  const [view, setView] = useState<"body" | "headers">("body");
  const remaining = call.headers.find(
    ([name]) => name.toLowerCase() === "x-ratelimit-remaining",
  )?.[1];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <StatusText status={call.status} />
        <span className="text-muted-foreground tabular-nums">
          {call.ms} ms · {formatBytes(call.bytes)}
          {remaining !== undefined && ` · ${remaining} left this minute`}
        </span>
        <span className="flex-1" />
        <ModeButton on={view === "body"} onClick={() => setView("body")}>
          Body
        </ModeButton>
        <ModeButton on={view === "headers"} onClick={() => setView("headers")}>
          Headers
        </ModeButton>
        <CopyButton
          size="sm"
          value={
            view === "body"
              ? call.body
              : call.headers.map(([n, v]) => `${n}: ${v}`).join("\n")
          }
        />
      </div>
      <Block className="max-h-[32rem]">
        {view === "body"
          ? call.body
          : call.headers.map(([name, value]) => `${name}: ${value}`).join("\n")}
      </Block>
    </div>
  );
}

function StatusText({ status }: { status: number }) {
  const tone =
    status < 300
      ? "text-emerald-500"
      : status < 500
        ? "text-amber-500"
        : "text-red-500";
  return (
    <span className={`font-mono font-semibold tabular-nums ${tone}`}>
      {status}
    </span>
  );
}

function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

// ------------------------------------------------------------------- updates

type Update = {
  id: string;
  type: ApiUpdateType;
  createdAt: string;
  gigId: string | null;
  eventId: string | null;
  orderId: string | null;
  data: Record<string, unknown>;
};

/** How often the updates view asks for more. */
const POLL_MS = 5_000;

/**
 * The update feed, live: starts from now, asks every few seconds with the
 * cursor it was given, and lists what arrives newest first. Exactly what an
 * integration polling the feed would see.
 */
function Updates({
  playgroundKey,
  onNeedKey,
}: {
  playgroundKey: PlaygroundKey | null;
  onNeedKey: () => void;
}) {
  const permissions = useMemo(
    () => scopesToPermissions(playgroundKey?.scopes ?? []),
    [playgroundKey],
  );
  const visible = API_UPDATE_TYPE_NAMES.filter(
    (type) =>
      hasScope(permissions, "updates:read") &&
      hasScope(permissions, API_UPDATE_TYPES[type].scope),
  );

  const [types, setTypes] = useState<ApiUpdateType[]>([]);
  const [running, setRunning] = useState(false);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cursor = useRef<string>("now");

  useEffect(() => {
    if (!running || !playgroundKey) return;
    let stopped = false;

    async function poll() {
      if (!playgroundKey) return;
      const query = new URLSearchParams({ cursor: cursor.current });
      if (types.length > 0) query.set("types", types.join(","));
      const call = await callApi(
        playgroundKey.key,
        "GET",
        `/updates?${query.toString()}`,
      );
      if (stopped) return;
      if (call.status !== 200) {
        setError(`${call.status}: ${call.body}`);
        setRunning(false);
        return;
      }
      const page = JSON.parse(call.body) as {
        data: Update[];
        nextCursor: string;
      };
      cursor.current = page.nextCursor;
      setError(null);
      if (page.data.length > 0) {
        setUpdates((current) =>
          [...page.data.reverse(), ...current].slice(0, 200),
        );
      }
    }

    void poll();
    const timer = setInterval(() => void poll(), POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [running, playgroundKey, types]);

  function toggle(type: ApiUpdateType) {
    setTypes((current) =>
      current.includes(type)
        ? current.filter((entry) => entry !== type)
        : [...current, type],
    );
  }

  const shown = updates.find((update) => update.id === selected) ?? updates[0];

  if (!playgroundKey) {
    return (
      <div className="text-muted-foreground rounded-md border border-dashed p-6 text-sm">
        The feed needs a key with updates:read.{" "}
        <button
          type="button"
          onClick={onNeedKey}
          className="text-foreground underline underline-offset-4"
        >
          Get one
        </button>
        .
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="min-w-0 space-y-4">
        <div className="space-y-2">
          <div className="text-muted-foreground text-xs">
            Types. None picked is every type this key can see.
          </div>
          <div className="flex flex-wrap gap-1">
            {API_UPDATE_TYPE_NAMES.map((type) => {
              const allowed = visible.includes(type);
              const on = types.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  disabled={!allowed}
                  onClick={() => toggle(type)}
                  title={
                    allowed
                      ? API_UPDATE_TYPES[type].description
                      : `Needs ${API_UPDATE_TYPES[type].scope}`
                  }
                  className={`rounded-md border px-2 py-0.5 font-mono text-xs disabled:opacity-40 ${
                    on
                      ? "bg-primary text-primary-foreground border-transparent"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {type}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            disabled={visible.length === 0}
            onClick={() => {
              if (!running) cursor.current = "now";
              setRunning(!running);
            }}
          >
            {running ? "Stop" : "Start"}
          </Button>
          <span className="text-muted-foreground text-xs">
            {visible.length === 0
              ? "This key can't read the feed: it needs updates:read and a read scope."
              : running
                ? `Asking every ${POLL_MS / 1000} seconds. Make a change in the admin to see it arrive.`
                : "Starts from now."}
          </span>
        </div>
        {error && <Block className="max-h-40 text-red-500">{error}</Block>}

        <div className="divide-border divide-y rounded-md border font-mono text-xs">
          {updates.length === 0 ? (
            <div className="text-muted-foreground px-3 py-6 text-center font-sans">
              Nothing yet.
            </div>
          ) : (
            updates.map((update) => (
              <button
                key={update.id}
                type="button"
                onClick={() => setSelected(update.id)}
                className={`flex w-full gap-3 px-3 py-1.5 text-left ${
                  update.id === shown?.id ? "bg-muted" : "hover:bg-muted/50"
                }`}
              >
                <span className="text-muted-foreground tabular-nums">
                  {new Date(update.createdAt).toLocaleTimeString()}
                </span>
                <span>{update.type}</span>
                <span className="text-muted-foreground min-w-0 truncate">
                  {update.eventId ?? update.gigId ?? update.orderId}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="min-w-0 space-y-2">
        <div className="text-muted-foreground text-xs">
          {shown ? shown.type : "Update"}
        </div>
        <Block className="max-h-[32rem]">
          {shown ? JSON.stringify(shown, null, 2) : "Pick an update."}
        </Block>
      </div>
    </div>
  );
}
