"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { env } from "~/env";
import { api, type RouterOutputs } from "~/trpc/react";
import {
  ALL_SCOPES,
  KEY_EXPIRY_DAYS,
  KEY_NAME_MAX_LENGTH,
  type ApiScope,
  type KeyExpiryDays,
} from "~/lib/developer/scopes";
import { CopyButton } from "~/components/admin/short-links/copy-button";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

/**
 * Name a key, pick what it may do, and get it back exactly once.
 *
 * Two states in one dialog: the form, then the key itself with a `curl` that
 * works as pasted. Closing the second state is the last chance to copy it;
 * only its hash is stored.
 */

type CreatedKey = RouterOutputs["developer"]["createKey"];

const EXPIRY_CHOICES: { value: KeyExpiryDays | null; label: string }[] = [
  { value: null, label: "Never" },
  ...KEY_EXPIRY_DAYS.map((days) => ({
    value: days,
    label: days === 365 ? "1 year" : `${days} days`,
  })),
];

export function CreateKeyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [created, setCreated] = useState<CreatedKey | null>(null);
  const [scopes, setScopes] = useState<ApiScope[]>([]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        // Forget the key once the dialog has finished closing, not as it
        // starts to: resetting earlier flashes the empty form during the fade.
        onCloseAutoFocus={() => {
          setCreated(null);
          setScopes([]);
        }}
      >
        {created ? (
          <RevealKey
            created={created}
            scopes={scopes}
            onDone={() => onOpenChange(false)}
          />
        ) : (
          <KeyForm
            scopes={scopes}
            onScopesChange={setScopes}
            onCreated={setCreated}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function KeyForm({
  scopes,
  onScopesChange,
  onCreated,
  onCancel,
}: {
  scopes: ApiScope[];
  onScopesChange: (scopes: ApiScope[]) => void;
  onCreated: (created: CreatedKey) => void;
  onCancel: () => void;
}) {
  const utils = api.useUtils();
  const [name, setName] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<KeyExpiryDays | null>(
    null,
  );

  const create = api.developer.createKey.useMutation({
    onSuccess: (created) => {
      void utils.developer.keys.invalidate();
      onCreated(created);
    },
    onError: (error) => toast.error(error.message),
  });

  function toggle(scope: ApiScope, on: boolean) {
    onScopesChange(
      on ? [...scopes, scope] : scopes.filter((entry) => entry !== scope),
    );
  }

  const ready = name.trim().length > 0 && scopes.length > 0;

  return (
    <form
      className="contents"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) create.mutate({ name, scopes, expiresInDays });
      }}
    >
      <DialogHeader>
        <DialogTitle>New API key</DialogTitle>
        <DialogDescription>
          Name it after what will use it, so it can be found and revoked later.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="api-key-name">Name</Label>
          <Input
            id="api-key-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={KEY_NAME_MAX_LENGTH}
            placeholder="Uptime Kuma"
            autoFocus
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">Scopes</legend>
          <div className="divide-border divide-y overflow-hidden rounded-md border">
            {ALL_SCOPES.map((entry) => {
              const id = `scope-${entry.scope}`;
              return (
                <label
                  key={entry.scope}
                  htmlFor={id}
                  className="hover:bg-muted/50 flex cursor-pointer items-start gap-3 px-3 py-2.5"
                >
                  <Checkbox
                    id={id}
                    className="mt-0.5"
                    checked={scopes.includes(entry.scope)}
                    onCheckedChange={(checked) =>
                      toggle(entry.scope, checked === true)
                    }
                  />
                  <span className="min-w-0 text-sm">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">{entry.label}</span>
                      <span className="text-muted-foreground font-mono text-xs">
                        {entry.scope}
                      </span>
                    </span>
                    <span
                      className={`block text-xs ${entry.dangerous ? "text-amber-500" : "text-muted-foreground"}`}
                    >
                      {entry.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="space-y-2">
          <Label>Expires</Label>
          <div
            role="radiogroup"
            aria-label="Expires"
            className="divide-border grid grid-cols-4 divide-x overflow-hidden rounded-md border"
          >
            {EXPIRY_CHOICES.map((choice) => (
              <button
                key={choice.label}
                type="button"
                role="radio"
                aria-checked={choice.value === expiresInDays}
                onClick={() => setExpiresInDays(choice.value)}
                className={`py-2 text-sm ${
                  choice.value === expiresInDays
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {choice.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!ready || create.isPending}>
          {create.isPending ? "Creating…" : "Create key"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function RevealKey({
  created,
  scopes,
  onDone,
}: {
  created: CreatedKey;
  scopes: ApiScope[];
  onDone: () => void;
}) {
  const example = exampleRequest(created.key, scopes);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{created.name}</DialogTitle>
        <DialogDescription>
          Copy the key now. This is the only time it is shown: only a hash of it
          is kept.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <code className="bg-muted/40 min-w-0 flex-1 rounded-md border px-3 py-2 font-mono text-sm break-all select-all">
            {created.key}
          </code>
          <CopyButton value={created.key} />
        </div>

        {example && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Try it</Label>
              <CopyButton value={example} size="sm" />
            </div>
            <pre className="bg-muted/40 overflow-x-auto rounded-md border p-3 font-mono text-xs leading-relaxed">
              {example}
            </pre>
          </div>
        )}

        <p className="flex items-start gap-2 text-xs text-amber-500">
          <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
          Treat it like a password. Anyone holding it can do what its scopes
          allow until it is turned off or deleted.
        </p>
      </div>

      <DialogFooter>
        <Button onClick={onDone}>Done</Button>
      </DialogFooter>
    </>
  );
}

/**
 * A request this key can actually make, so the first thing somebody pastes
 * works: a send to `team` if it can, otherwise discovery, otherwise a direct
 * send to fill in. Never an announcement: a test paste should not reach every
 * punter's phone, so an announce-only key gets no example.
 */
function exampleRequest(key: string, scopes: ApiScope[]): string | null {
  const base = `${env.NEXT_PUBLIC_APP_URL}/api/v1/notifications`;

  if (scopes.includes("notifications:topic")) {
    return [
      `curl ${base}/send \\`,
      `  -H "Authorization: Bearer ${key}" \\`,
      `  -H "Content-Type: application/json" \\`,
      `  -d '{"to":{"topic":"team"},"title":"Hello","message":"Sent with a new API key"}'`,
    ].join("\n");
  }
  if (scopes.includes("notifications:recipients")) {
    return `curl ${base}/recipients \\\n  -H "Authorization: Bearer ${key}"`;
  }
  if (!scopes.includes("notifications:direct")) return null;
  return [
    `curl ${base}/send \\`,
    `  -H "Authorization: Bearer ${key}" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{"to":{"users":["<user id>"]},"message":"Hello"}'`,
  ].join("\n");
}
