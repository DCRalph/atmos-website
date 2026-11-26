"use client";

import { useMemo, useState, type ReactNode } from "react";

import { env } from "~/env";
import { api } from "~/trpc/react";
import {
  operationsOf,
  type OpenApiSpec,
  type SpecOperation,
} from "~/lib/developer/openapi";
import {
  ALL_SCOPES,
  KEY_REQUESTS_PER_MINUTE,
  SCOPE_RESOURCE_LABELS,
  type ScopeResource,
} from "~/lib/developer/scopes";
import {
  exampleBody,
  exampleFor,
  operationKey,
  responseSchema,
  snippet,
  SNIPPETS,
  type Snippet,
} from "~/lib/developer/snippets";
import {
  API_UPDATE_TYPES,
  API_UPDATE_TYPE_NAMES,
  UPDATE_RETENTION_DAYS,
} from "~/lib/developer/updates";
import { CopyButton } from "~/components/admin/short-links/copy-button";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Block, Code, FieldTable, Method, ScopeBadge } from "./api-docs-parts";

/**
 * The developer API's reference, in the usual three panes: everything on the
 * left, the selected page in the middle, and code for it on the right.
 *
 * Endpoint pages are drawn from the OpenAPI spec, so they follow the endpoint
 * list in `~/server/developer-api` without anyone editing this file. The guide
 * pages (authentication, scopes, errors and so on) are written here. The long
 * form, with the reasoning, is `docs/DEVELOPER-API.md`.
 */

const GUIDES = [
  { key: "guide:auth", label: "Authentication" },
  { key: "guide:scopes", label: "Scopes" },
  { key: "guide:conventions", label: "Conventions" },
  { key: "guide:errors", label: "Errors" },
  { key: "guide:updates", label: "Update feed" },
  { key: "guide:ntfy", label: "ntfy endpoint" },
] as const;

type GuideKey = (typeof GUIDES)[number]["key"];

export function ApiReference({
  onTry,
}: {
  onTry: (operation: SpecOperation) => void;
}) {
  const spec = api.developer.spec.useQuery(undefined, {
    staleTime: Infinity,
  });
  const [selected, setSelected] = useState<string>("guide:auth");
  const [language, setLanguage] = useState<Snippet>("curl");

  const operations = useMemo(
    () => (spec.data ? operationsOf(spec.data) : []),
    [spec.data],
  );

  if (!spec.data) {
    return spec.isError ? (
      <p className="text-muted-foreground text-sm">
        Couldn&apos;t load the reference.
      </p>
    ) : (
      <Skeleton className="h-96 w-full" />
    );
  }

  const operation = operations.find((op) => operationKey(op) === selected);

  return (
    <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] xl:grid-cols-[13rem_minmax(0,1fr)_26rem]">
      <Nav
        spec={spec.data}
        operations={operations}
        selected={selected}
        onSelect={setSelected}
      />
      {operation ? (
        <>
          <OperationPage operation={operation} />
          <CodePane
            operation={operation}
            base={spec.data.servers[0].url}
            language={language}
            onLanguage={setLanguage}
            onTry={() => onTry(operation)}
          />
        </>
      ) : (
        <div className="min-w-0 xl:col-span-2">
          <Guide guide={selected as GuideKey} spec={spec.data} />
        </div>
      )}
    </div>
  );
}

function Nav({
  spec,
  operations,
  selected,
  onSelect,
}: {
  spec: OpenApiSpec;
  operations: SpecOperation[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  const item = (key: string, children: ReactNode) => (
    <button
      key={key}
      type="button"
      onClick={() => onSelect(key)}
      aria-current={key === selected ? "page" : undefined}
      className={`flex w-full items-baseline gap-2 rounded-md px-2 py-1 text-left text-sm ${
        key === selected
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );

  return (
    <nav className="max-h-72 space-y-4 overflow-y-auto lg:sticky lg:top-4 lg:max-h-[calc(100vh-8rem)] lg:self-start">
      <NavGroup label="Guides">
        {GUIDES.map((guide) => item(guide.key, guide.label))}
      </NavGroup>
      {spec.tags.map((tag) => {
        const inTag = operations.filter((op) => op.tags[0] === tag.name);
        if (inTag.length === 0) return null;
        return (
          <NavGroup key={tag.name} label={tag.name}>
            {inTag.map((op) =>
              item(
                operationKey(op),
                <>
                  <span className="w-8 shrink-0">
                    <Method method={op.method} short />
                  </span>
                  <span className="truncate">{op.summary}</span>
                </>,
              ),
            )}
          </NavGroup>
        );
      })}
    </nav>
  );
}

function NavGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-muted-foreground mb-1 px-2 text-xs font-medium tracking-wide uppercase">
        {label}
      </div>
      {children}
    </div>
  );
}

function OperationPage({ operation }: { operation: SpecOperation }) {
  const pathParams = operation.parameters.filter((p) => p.in === "path");
  const queryParams = operation.parameters.filter((p) => p.in === "query");
  const body = operation.requestBody?.content["application/json"].schema;
  const [status] = Object.keys(operation.responses).filter((s) =>
    s.startsWith("2"),
  );

  return (
    <article className="min-w-0 space-y-6">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold">{operation.summary}</h2>
        <div className="flex flex-wrap items-center gap-2 font-mono text-sm">
          <Method method={operation.method} />
          <span className="break-all">/api/v1{operation.path}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {operation["x-scopes"].length === 0 ? (
            <span className="text-muted-foreground text-xs">
              Any working key
            </span>
          ) : (
            operation["x-scopes"].map((scope) => (
              <ScopeBadge key={scope} scope={scope} />
            ))
          )}
          {operation["x-widened-by"].length > 0 && (
            <span className="text-muted-foreground ml-1 text-xs">
              More fields with{" "}
              {operation["x-widened-by"].map((scope, index) => (
                <span key={scope}>
                  {index > 0 && ", "}
                  <Code>{scope}</Code>
                </span>
              ))}
            </span>
          )}
        </div>
        {operation.description && (
          <p className="text-muted-foreground text-sm">
            {operation.description}
          </p>
        )}
        {operation["x-scopes"].length > 1 && (
          <p className="text-muted-foreground text-xs">
            Which of these scopes a request needs depends on what it sends.
          </p>
        )}
      </header>

      {pathParams.length > 0 && (
        <Section title="Path">
          <ParamTable params={pathParams} />
        </Section>
      )}
      {queryParams.length > 0 && (
        <Section title="Query">
          <ParamTable params={queryParams} />
        </Section>
      )}
      {body && (
        <Section title="Body">
          <FieldTable schema={body} />
        </Section>
      )}
      <Section title={`Response ${status ?? "200"}`}>
        <FieldTable schema={responseSchema(operation)} />
      </Section>
    </article>
  );
}

function ParamTable({ params }: { params: SpecOperation["parameters"] }) {
  return (
    <FieldTable
      schema={{
        type: "object",
        properties: Object.fromEntries(
          params.map((param) => [
            param.name,
            { ...param.schema, description: param.description },
          ]),
        ),
        required: params.filter((p) => p.required).map((p) => p.name),
      }}
      depth={0}
    />
  );
}

function CodePane({
  operation,
  base,
  language,
  onLanguage,
  onTry,
}: {
  operation: SpecOperation;
  base: string;
  language: Snippet;
  onLanguage: (language: Snippet) => void;
  onTry: () => void;
}) {
  const code = snippet(language, {
    base,
    method: operation.method,
    path: operation.path,
    body: exampleBody(operation),
  });
  const response = JSON.stringify(
    exampleFor(responseSchema(operation)),
    null,
    2,
  );

  return (
    <aside className="min-w-0 space-y-3 lg:col-start-2 xl:sticky xl:top-4 xl:col-start-3 xl:self-start">
      <div className="flex items-center gap-1">
        {SNIPPETS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onLanguage(option.value)}
            className={`rounded-md px-2 py-1 text-xs ${
              option.value === language
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        ))}
        <span className="flex-1" />
        <CopyButton value={code} size="sm" />
        <Button size="sm" variant="outline" onClick={onTry}>
          Try it
        </Button>
      </div>
      <Block className="max-h-80">{code}</Block>
      <div className="text-muted-foreground text-xs">Response</div>
      <Block className="max-h-96">{response}</Block>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
  );
}

function Guide({ guide, spec }: { guide: GuideKey; spec: OpenApiSpec }) {
  const base = spec.servers[0].url;
  switch (guide) {
    case "guide:auth":
      return (
        <GuidePage title="Authentication">
          <p>
            Send a key from the Keys tab as a bearer token. HTTP basic with the
            key as the password, and ntfy&apos;s <Code>?auth=</Code>, work too.
            Each key may make {KEY_REQUESTS_PER_MINUTE} requests a minute.
          </p>
          <Block>{`curl ${base}/me \\\n  -H "Authorization: Bearer $ATMOS_API_KEY"`}</Block>
          <p>
            <Code>GET /me</Code> needs no scope, and answers with the key&apos;s
            name and scopes, so it is the way to check a key works. Every
            response carries <Code>X-Request-Id</Code>, and{" "}
            <Code>X-RateLimit-Remaining</Code> says how many requests are left
            this minute.
          </p>
          <p>
            The whole API is described as OpenAPI 3.1 at{" "}
            <a
              href={`${base}/openapi.json`}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4"
            >
              /api/v1/openapi.json
            </a>
            , for Postman, Insomnia or generating a client.
          </p>
        </GuidePage>
      );
    case "guide:scopes":
      return (
        <GuidePage title="Scopes">
          <p>
            A key can do only what its scopes allow. Reading and writing are
            separate everywhere. A <Code>sensitive</Code> scope grants no
            endpoint by itself: it adds the personal or secret fields to what
            the matching read returns, such as buyer emails or a private
            event&apos;s key. Amber scopes reach people, move money, or reveal
            personal data.
          </p>
          <div className="divide-border divide-y rounded-md border">
            {(Object.keys(SCOPE_RESOURCE_LABELS) as ScopeResource[]).map(
              (resource) => (
                <div key={resource} className="px-3 py-2">
                  <div className="mb-1 text-sm font-medium">
                    {SCOPE_RESOURCE_LABELS[resource]}
                  </div>
                  {ALL_SCOPES.filter((e) => e.resource === resource).map(
                    (entry) => (
                      <div
                        key={entry.scope}
                        className="grid gap-1 py-1 text-sm sm:grid-cols-[13rem_1fr] sm:gap-4"
                      >
                        <Code>{entry.scope}</Code>
                        <span
                          className={
                            entry.dangerous
                              ? "text-amber-500"
                              : "text-muted-foreground"
                          }
                        >
                          {entry.description}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              ),
            )}
          </div>
        </GuidePage>
      );
    case "guide:conventions":
      return (
        <GuidePage title="Conventions">
          <ul className="list-disc space-y-1 pl-5">
            <li>JSON in and out.</li>
            <li>
              Times are ISO 8601. Send them with an offset (
              <Code>2026-12-12T20:00:00+13:00</Code> or <Code>…Z</Code>); they
              come back in UTC.
            </li>
            <li>
              Money is in integer cents, NZD. Percentages in basis points say
              so: <Code>250</Code> is 2.5%.
            </li>
            <li>
              <Code>PATCH</Code> takes only the fields that change. Fields left
              out stay as they are, and <Code>null</Code> clears one.
            </li>
            <li>
              Lists take <Code>limit</Code> (up to 100) and <Code>cursor</Code>,
              and answer with{" "}
              <Code>{`{ "data": [...], "nextCursor": "…" }`}</Code>. Pass{" "}
              <Code>nextCursor</Code> back as <Code>cursor</Code> for the next
              page; it is <Code>null</Code> on the last.
            </li>
            <li>
              Writes go through the same checks as the admin, and show in the
              activity log under the key&apos;s name.
            </li>
          </ul>
        </GuidePage>
      );
    case "guide:errors":
      return (
        <GuidePage title="Errors">
          <Block>{`{ "error": { "code": "missing_scope", "message": "…" } }`}</Block>
          <p>
            Anything more rides inside <Code>error</Code>: <Code>issues</Code>{" "}
            on a validation failure, <Code>missing</Code> on a scope one,{" "}
            <Code>ids</Code> when a send names unknown recipients.
          </p>
          <div className="divide-border divide-y rounded-md border text-sm">
            {ERRORS.map(([status, code, meaning]) => (
              <div
                key={code}
                className="grid grid-cols-[3rem_10rem_1fr] gap-4 px-3 py-2"
              >
                <span className="tabular-nums">{status}</span>
                <Code>{code}</Code>
                <span className="text-muted-foreground">{meaning}</span>
              </div>
            ))}
          </div>
        </GuidePage>
      );
    case "guide:updates":
      return (
        <GuidePage title="Update feed">
          <p>
            <Code>GET /updates</Code> is everything that changed, in order, from
            the admin, Will GPT or the API. Keep the <Code>nextCursor</Code> it
            gives and ask again with it: when there is nothing new the cursor
            comes back unchanged, so polling every few seconds is fine, and a
            script that was offline picks up where it stopped. Updates are kept
            for {UPDATE_RETENTION_DAYS} days.
          </p>
          <p>
            Updates are thin. They name what changed and carry a few facts that
            are not personal; the detail is one request away, under that
            endpoint&apos;s own scopes. Each type needs the scope below as well
            as <Code>updates:read</Code>.
          </p>
          <div className="divide-border divide-y rounded-md border text-sm">
            {API_UPDATE_TYPE_NAMES.map((type) => (
              <div
                key={type}
                className="grid gap-1 px-3 py-2 sm:grid-cols-[11rem_8rem_1fr] sm:gap-4"
              >
                <Code>{type}</Code>
                <Code>{API_UPDATE_TYPES[type].scope}</Code>
                <span className="text-muted-foreground">
                  {API_UPDATE_TYPES[type].description}
                </span>
              </div>
            ))}
          </div>
          <Block>{`curl "${base}/updates?cursor=0&types=order.paid,tier.sold_out" \\
  -H "Authorization: Bearer $ATMOS_API_KEY"`}</Block>
        </GuidePage>
      );
    case "guide:ntfy":
      return (
        <GuidePage title="ntfy endpoint">
          <p>
            <Code>/api/notify</Code> speaks{" "}
            <a
              href="https://docs.ntfy.sh/publish/"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4"
            >
              ntfy&apos;s publish API
            </a>
            , for anything that already does: Uptime Kuma, Home Assistant, the
            ntfy CLI. It takes the same keys, with the topic scopes.
          </p>
          <Block>{`curl -H "Authorization: Bearer $ATMOS_API_KEY" \\
     -H "Title: Side door" -H "Priority: high" \\
     -d "Card reader is down" \\
     ${env.NEXT_PUBLIC_APP_URL}/api/notify/team`}</Block>
        </GuidePage>
      );
  }
}

function GuidePage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <article className="max-w-3xl space-y-4 text-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </article>
  );
}

const ERRORS = [
  [400, "invalid_body", "Not JSON, or the body failed validation."],
  [400, "invalid_request", "A path or query parameter failed validation."],
  [400, "bad_request", "Valid, but the site said no, with why."],
  [400, "unknown_recipients", "A send named ids that are not staff."],
  [401, "unauthorized", "No key, a wrong key, or one disabled or expired."],
  [403, "missing_scope", "The key is fine but cannot do this."],
  [404, "not_found", "No such endpoint, or no such thing."],
  [405, "method_not_allowed", "The path exists; Allow lists its methods."],
  [409, "conflict", "It clashes with what is there, such as a taken slug."],
  [
    429,
    "rate_limited",
    `Over ${KEY_REQUESTS_PER_MINUTE} a minute. Retry-After says when to retry.`,
  ],
  [500, "internal_error", "Our fault. The message has a request id."],
] as const;
