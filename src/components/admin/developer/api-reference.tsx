"use client";

import type { ReactNode } from "react";

import { env } from "~/env";
import { api } from "~/trpc/react";
import { ALL_SCOPES, KEY_REQUESTS_PER_MINUTE } from "~/lib/developer/scopes";
import { MAX_RECIPIENTS } from "~/lib/notify/send-request";
import { CopyButton } from "~/components/admin/short-links/copy-button";
import { Badge } from "~/components/ui/badge";

/**
 * The notifications API, documented where the keys are made. Examples use
 * this site's own URL, and discovery is shown live, so the ids a direct send
 * needs can be copied straight out of it. The long form, with the reasoning,
 * is `docs/DEVELOPER-API.md`.
 */
export function ApiReference() {
  const base = `${env.NEXT_PUBLIC_APP_URL}/api/v1/notifications`;

  return (
    <div className="max-w-4xl space-y-10">
      <Section title="Authentication">
        <p>
          Send a key from the Keys tab as a bearer token. HTTP basic with the
          key as the password, and ntfy&apos;s <Code>?auth=</Code>, work too.
          Each key is limited to {KEY_REQUESTS_PER_MINUTE} requests a minute.
        </p>
        <Block>{`Authorization: Bearer atmos_…`}</Block>
      </Section>

      <Section title="Scopes">
        <div className="divide-border divide-y rounded-md border">
          {ALL_SCOPES.map((entry) => (
            <div
              key={entry.scope}
              className="grid gap-1 px-3 py-2 sm:grid-cols-[14rem_1fr] sm:gap-4"
            >
              <Code>{entry.scope}</Code>
              <span
                className={
                  entry.dangerous ? "text-amber-500" : "text-muted-foreground"
                }
              >
                {entry.description}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Discover recipients"
        endpoint={{ method: "GET", path: "/recipients" }}
      >
        <p>
          Every topic with how many devices hear it, staff with their devices,
          and everyone else as a count. Customers are never listed. Needs{" "}
          <Code>notifications:recipients</Code>.
        </p>
        <Block>{`curl ${base}/recipients \\\n  -H "Authorization: Bearer $ATMOS_API_KEY"`}</Block>
        <LiveRecipients />
      </Section>

      <Section title="Send" endpoint={{ method: "POST", path: "/send" }}>
        <p>
          One notification to exactly one target: a topic, staff by user id, or
          particular devices by device id. Up to {MAX_RECIPIENTS} ids.
        </p>
        <Block>{`curl ${base}/send \\
  -H "Authorization: Bearer $ATMOS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": { "topic": "team" },
    "title": "Side door",
    "message": "Card reader is down",
    "priority": 4,
    "click": "/tickets",
    "tags": ["warning"]
  }'`}</Block>
        <dl className="divide-border divide-y rounded-md border">
          <Field name="to" required>
            <Code>{`{ "topic": "team" }`}</Code> needs{" "}
            <Code>notifications:topic</Code>, or{" "}
            <Code>notifications:announce</Code> for <Code>announcements</Code>.{" "}
            <Code>{`{ "users": [ids] }`}</Code> or{" "}
            <Code>{`{ "devices": [ids] }`}</Code> needs{" "}
            <Code>notifications:direct</Code>, and every id must be one
            discovery lists, or nothing is sent.
          </Field>
          <Field name="message" required>
            Up to 4096 characters.
          </Field>
          <Field name="title">
            Up to 250. Without one, handsets show the topic&apos;s name, or
            &ldquo;Atmos&rdquo; for a direct send.
          </Field>
          <Field name="priority">
            1 to 5, or <Code>min</Code>, <Code>low</Code>, <Code>default</Code>,{" "}
            <Code>high</Code>, <Code>max</Code>. 1 and 2 are silent; 4 and 5
            arrive immediately. Defaults to 3.
          </Field>
          <Field name="click">
            What a tap opens. A URL opens the browser; a path like{" "}
            <Code>/tickets</Code> opens that screen in the app.
          </Field>
          <Field name="tags">Up to 20 strings, shown as text.</Field>
        </dl>
        <p>
          Direct sends reach the person whatever their notification settings,
          like a run sheet cue. The response says how many devices were in the
          audience and how many Expo accepted:
        </p>
        <Block>{`{
  "id": "clx…",
  "createdAt": "2026-10-28T03:15:00.000Z",
  "to": { "topic": "team" },
  "delivery": { "devices": 6, "delivered": 6 }
}`}</Block>
      </Section>

      <Section title="ntfy">
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
      </Section>

      <Section title="Errors">
        <Block>{`{ "error": { "code": "missing_scope", "message": "…" } }`}</Block>
        <div className="divide-border divide-y rounded-md border">
          {ERRORS.map(([status, code, meaning]) => (
            <div
              key={code}
              className="grid grid-cols-[3rem_11rem_1fr] gap-4 px-3 py-2"
            >
              <span className="tabular-nums">{status}</span>
              <Code>{code}</Code>
              <span className="text-muted-foreground">{meaning}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

const ERRORS = [
  [400, "invalid_body", "Not JSON, or the body failed validation."],
  [
    400,
    "unknown_recipients",
    "Some ids are not staff or staff devices. They are listed in error.ids.",
  ],
  [401, "unauthorized", "No key, a wrong key, or one disabled or expired."],
  [403, "missing_scope", "The key is fine but cannot do this."],
  [
    429,
    "rate_limited",
    `Over ${KEY_REQUESTS_PER_MINUTE} a minute. Retry-After says when to retry.`,
  ],
] as const;

/** What discovery returns right now, as JSON. */
function LiveRecipients() {
  const recipients = api.developer.recipients.useQuery();
  const json = recipients.data
    ? JSON.stringify(recipients.data, null, 2)
    : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs">
          Live, from this site
        </span>
        {json && <CopyButton value={json} size="sm" />}
      </div>
      <Block className="max-h-96">
        {json ?? (recipients.isLoading ? "Loading…" : "Couldn't load")}
      </Block>
    </div>
  );
}

function Section({
  title,
  endpoint,
  children,
}: {
  title: string;
  endpoint?: { method: "GET" | "POST"; path: string };
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 text-sm">
      <h2 className="flex flex-wrap items-center gap-3 text-lg font-semibold">
        {title}
        {endpoint && (
          <span className="flex items-center gap-2 text-sm font-normal">
            <Badge variant="secondary" className="font-mono">
              {endpoint.method}
            </Badge>
            <Code>/api/v1/notifications{endpoint.path}</Code>
          </span>
        )}
      </h2>
      {children}
    </section>
  );
}

function Field({
  name,
  required,
  children,
}: {
  name: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1 px-3 py-2 sm:grid-cols-[8rem_1fr] sm:gap-4">
      <dt>
        <Code>{name}</Code>
        {required && (
          <span className="text-muted-foreground ml-2 text-xs">required</span>
        )}
      </dt>
      <dd className="text-muted-foreground">{children}</dd>
    </div>
  );
}

function Code({ children }: { children: ReactNode }) {
  return <code className="font-mono text-[0.85em]">{children}</code>;
}

function Block({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <pre
      className={`bg-muted/40 overflow-auto rounded-md border p-3 font-mono text-xs leading-relaxed ${className}`}
    >
      {children}
    </pre>
  );
}
