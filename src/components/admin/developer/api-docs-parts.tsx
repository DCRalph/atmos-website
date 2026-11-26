"use client";

import { Fragment, type ReactNode } from "react";

import type { JsonSchema, OpenApiMethod } from "~/lib/developer/openapi";
import { ALL_SCOPES, type ApiScope } from "~/lib/developer/scopes";
import { objectSchema, typeLabel } from "~/lib/developer/snippets";
import { Badge } from "~/components/ui/badge";

/** Pieces shared by the API reference and the playground. */

const METHOD_TONE: Record<OpenApiMethod, string> = {
  get: "text-sky-500",
  post: "text-emerald-500",
  patch: "text-amber-500",
  delete: "text-red-500",
};

export function Method({
  method,
  short = false,
}: {
  method: OpenApiMethod;
  short?: boolean;
}) {
  const label = method.toUpperCase();
  return (
    <span className={`font-mono text-xs font-semibold ${METHOD_TONE[method]}`}>
      {short && label === "DELETE" ? "DEL" : label}
    </span>
  );
}

const DANGEROUS = new Set<ApiScope>(
  ALL_SCOPES.filter((entry) => entry.dangerous).map((entry) => entry.scope),
);

export function ScopeBadge({ scope }: { scope: ApiScope }) {
  return (
    <Badge
      variant="outline"
      className={`font-mono ${DANGEROUS.has(scope) ? "border-amber-500/50 text-amber-500" : ""}`}
    >
      {scope}
    </Badge>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return <code className="font-mono text-[0.85em]">{children}</code>;
}

export function Block({
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

/**
 * An object schema as a table of its fields, with objects and lists of
 * objects opened out underneath, a level at a time, up to `depth`.
 */
export function FieldTable({
  schema,
  depth = 2,
}: {
  schema: JsonSchema | undefined;
  depth?: number;
}) {
  const object = objectSchema(schema);
  if (!object?.properties) {
    return <p className="text-muted-foreground text-xs">No fields.</p>;
  }
  return (
    <div className="divide-border divide-y rounded-md border text-xs">
      <FieldRows schema={object} depth={depth} prefix="" />
    </div>
  );
}

function FieldRows({
  schema,
  depth,
  prefix,
}: {
  schema: JsonSchema;
  depth: number;
  prefix: string;
}) {
  const required = new Set(schema.required ?? []);
  return Object.entries(schema.properties ?? {}).map(([name, field]) => {
    const nested = depth > 0 ? objectSchema(field) : null;
    return (
      <Fragment key={name}>
        <div className="grid gap-1 px-3 py-2 sm:grid-cols-[minmax(8rem,14rem)_1fr] sm:gap-4">
          <div className="min-w-0">
            <span className="text-muted-foreground font-mono">{prefix}</span>
            <span className="font-mono font-medium break-all">{name}</span>
            {required.has(name) && (
              <span className="text-muted-foreground ml-2">required</span>
            )}
          </div>
          <div className="min-w-0 space-y-0.5">
            <div className="text-muted-foreground font-mono break-words">
              {typeLabel(field)}
            </div>
            {field.description && <p>{field.description}</p>}
          </div>
        </div>
        {nested?.properties && (
          <FieldRows
            schema={nested}
            depth={depth - 1}
            prefix={`${prefix}${name}${typeLabel(field).includes("[]") ? "[]" : ""}.`}
          />
        )}
      </Fragment>
    );
  });
}
