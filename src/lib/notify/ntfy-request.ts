import {
  DEFAULT_PRIORITY,
  isValidTopic,
  parsePriority,
  type NotifyPriority,
} from "./topics";

/**
 * Parsing an ntfy publish request.
 *
 * Kept as a pure function over the pieces of a request rather than over a
 * `Request` so it can be tested without standing up a route, and so the route
 * handler is left doing nothing but auth and I/O.
 *
 * What is supported, matching https://docs.ntfy.sh/publish/:
 *
 *   POST|PUT|GET  /api/notify/{topic}          body is the message
 *   POST          /api/notify                  JSON body carrying `topic`
 *   /{topic}/publish, /send, /trigger          the same, with ntfy's suffixes
 *
 * Fields come from headers, then the query string, then the body — so
 * `curl -d "Doors are jammed" -H "Title: Side door"` and
 * `curl "…/team?title=Side+door&message=Doors+are+jammed"` are the same call.
 *
 * Deliberately not supported: multi-topic publish (`/topic1,topic2`),
 * attachments, scheduled delivery, actions and email forwarding. Each would be
 * a feature in its own right rather than a parsing detail, and a request using
 * one gets a clear 400 instead of silently losing it.
 */

export type PublishInput = {
  topic: string;
  message: string;
  title?: string;
  priority: NotifyPriority;
  tags: string[];
  /** URL the notification opens when tapped. ntfy's `Click` header. */
  click?: string;
};

export type ParseResult =
  { ok: true; input: PublishInput } | { ok: false; error: string };

/** ntfy's own limits, so a caller that works there works here. */
const MAX_MESSAGE = 4096;
const MAX_TITLE = 250;
const MAX_TAGS = 20;

/** ntfy's stand-in when a publish carries no message at all. */
const EMPTY_MESSAGE = "triggered";

/** Path suffixes ntfy accepts after a topic, for URLs that must end in a verb. */
const PUBLISH_SUFFIXES = new Set(["publish", "send", "trigger"]);

export function parsePublishRequest({
  pathSegments,
  searchParams,
  headers,
  body,
}: {
  pathSegments: readonly string[];
  searchParams: URLSearchParams;
  headers: Headers;
  body: string;
}): ParseResult {
  const segments = [...pathSegments];
  const last = segments.at(-1);
  if (last !== undefined && PUBLISH_SUFFIXES.has(last.toLowerCase())) {
    segments.pop();
  }

  if (segments.length > 1) {
    return { ok: false, error: "invalid topic" };
  }

  const pathTopic = segments[0];
  return pathTopic === undefined
    ? parseJsonPublish(body)
    : parseFieldPublish({ topic: pathTopic, searchParams, headers, body });
}

/** `POST /api/notify` — everything in one JSON object, ntfy's "publish as JSON". */
function parseJsonPublish(body: string): ParseResult {
  if (body.trim().length === 0) {
    return { ok: false, error: "topic required" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { ok: false, error: "invalid JSON body" };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: "invalid JSON body" };
  }

  const fields = parsed as Record<string, unknown>;
  const topic = typeof fields.topic === "string" ? fields.topic : "";

  // ntfy sends this as a number, but a hand-rolled caller tends to send the
  // name instead, so both are read through the same parser.
  let priority: NotifyPriority = DEFAULT_PRIORITY;
  const rawPriority = fields.priority;
  if (rawPriority !== undefined && rawPriority !== null) {
    const resolved =
      typeof rawPriority === "string" || typeof rawPriority === "number"
        ? parsePriority(String(rawPriority))
        : null;
    if (!resolved) return { ok: false, error: "invalid priority" };
    priority = resolved;
  }

  // ntfy takes tags as an array here, but a caller hand-rolling the JSON tends
  // to send the comma string the header form uses.
  const tags = Array.isArray(fields.tags)
    ? fields.tags.filter((tag): tag is string => typeof tag === "string")
    : typeof fields.tags === "string"
      ? splitTags(fields.tags)
      : [];

  return finish({
    topic,
    message: typeof fields.message === "string" ? fields.message : "",
    title: typeof fields.title === "string" ? fields.title : undefined,
    priority,
    tags,
    click: typeof fields.click === "string" ? fields.click : undefined,
  });
}

/** `POST /api/notify/{topic}` — headers, query string, then body. */
function parseFieldPublish({
  topic,
  searchParams,
  headers,
  body,
}: {
  topic: string;
  searchParams: URLSearchParams;
  headers: Headers;
  body: string;
}): ParseResult {
  const field = (...names: string[]): string | undefined => {
    for (const name of names) {
      const header = headers.get(name);
      if (header !== null && header.length > 0) return header;
    }
    for (const name of names) {
      const query = searchParams.get(name);
      if (query !== null && query.length > 0) return query;
    }
    return undefined;
  };

  const rawPriority = field("x-priority", "priority", "prio", "p");
  const priority = rawPriority ? parsePriority(rawPriority) : DEFAULT_PRIORITY;
  if (!priority) return { ok: false, error: "invalid priority" };

  const rawTags = field("x-tags", "tags", "tag", "ta");

  return finish({
    topic,
    message: field("x-message", "message", "m") ?? body,
    title: field("x-title", "title", "t"),
    priority,
    tags: rawTags ? splitTags(rawTags) : [],
    click: field("x-click", "click"),
  });
}

function splitTags(raw: string): string[] {
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

/** Trim, bound and validate whatever the two parsers produced. */
function finish(input: PublishInput): ParseResult {
  const topic = input.topic.trim();
  if (!isValidTopic(topic)) return { ok: false, error: "invalid topic" };

  const message = input.message.trim();
  if (message.length > MAX_MESSAGE) {
    return { ok: false, error: "message too long" };
  }

  const title = input.title?.trim();
  if (title !== undefined && title.length > MAX_TITLE) {
    return { ok: false, error: "title too long" };
  }

  const click = input.click?.trim();

  return {
    ok: true,
    input: {
      topic,
      message: message.length > 0 ? message : EMPTY_MESSAGE,
      title: title !== undefined && title.length > 0 ? title : undefined,
      priority: input.priority,
      tags: input.tags.slice(0, MAX_TAGS),
      click: click !== undefined && click.length > 0 ? click : undefined,
    },
  };
}
