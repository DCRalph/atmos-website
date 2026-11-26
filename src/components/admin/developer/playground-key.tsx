"use client";

import { useState } from "react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import {
  isApiScope,
  SCOPE_PRESETS,
  type ApiScope,
} from "~/lib/developer/scopes";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { ScopeChecklist } from "./scope-checklist";

/**
 * The key the playground sends with. Either a temporary one made for it,
 * which lasts an hour, or one pasted in. Held in memory only: a reload
 * forgets it, and nothing is written to the browser.
 */
export type PlaygroundKey = {
  key: string;
  name: string;
  scopes: ApiScope[];
  expiresAt: Date | null;
};

export type ApiCall = {
  method: string;
  path: string;
  status: number;
  ms: number;
  bytes: number;
  headers: [string, string][];
  body: string;
  at: Date;
};

/** One request to the API with the playground's key, timed. */
export async function callApi(
  key: string,
  method: string,
  path: string,
  body?: string,
): Promise<ApiCall> {
  const started = performance.now();
  const response = await fetch(`/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body,
    credentials: "omit",
  });
  const text = await response.text();
  return {
    method,
    path,
    status: response.status,
    ms: Math.round(performance.now() - started),
    bytes: new Blob([text]).size,
    headers: [...response.headers.entries()],
    body: prettyJson(text),
    at: new Date(),
  };
}

function prettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export function KeyDialog({
  open,
  onOpenChange,
  onKey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onKey: (key: PlaygroundKey) => void;
}) {
  const [scopes, setScopes] = useState<ApiScope[]>([
    ...SCOPE_PRESETS[0].scopes,
  ]);
  const [pasted, setPasted] = useState("");
  const [checking, setChecking] = useState(false);

  const create = api.developer.createPlaygroundKey.useMutation({
    onSuccess: (created) => {
      onKey({
        key: created.key,
        name: "Temporary",
        scopes: created.scopes,
        expiresAt: created.expiresAt,
      });
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message),
  });

  async function adoptPasted() {
    setChecking(true);
    try {
      const me = await callApi(pasted.trim(), "GET", "/me");
      if (me.status !== 200) {
        toast.error("That key didn't work.");
        return;
      }
      const parsed = JSON.parse(me.body) as {
        name: string;
        scopes: string[];
        expiresAt: string | null;
      };
      onKey({
        key: pasted.trim(),
        name: parsed.name,
        scopes: parsed.scopes.filter(isApiScope),
        expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
      });
      setPasted("");
      onOpenChange(false);
    } finally {
      setChecking(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Playground key</DialogTitle>
          <DialogDescription>
            A temporary key has the scopes picked here and stops working in an
            hour. Requests are real: anything but a GET changes the site.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Label>Scopes</Label>
              <div className="flex flex-wrap gap-1">
                {SCOPE_PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setScopes([...preset.scopes])}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
            <ScopeChecklist
              idPrefix="playground-scope"
              selected={scopes}
              onToggle={(scope, on) =>
                setScopes((current) =>
                  on
                    ? [...current, scope]
                    : current.filter((entry) => entry !== scope),
                )
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="playground-paste">Or use a key you have</Label>
            <div className="flex gap-2">
              <Input
                id="playground-paste"
                value={pasted}
                onChange={(event) => setPasted(event.target.value)}
                placeholder="atmos_…"
                className="font-mono"
                autoComplete="off"
              />
              <Button
                type="button"
                variant="outline"
                disabled={!pasted.trim() || checking}
                onClick={() => void adoptPasted()}
              >
                {checking ? "Checking…" : "Use"}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={scopes.length === 0 || create.isPending}
            onClick={() => create.mutate({ scopes })}
          >
            {create.isPending ? "Making…" : "Make a temporary key"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
