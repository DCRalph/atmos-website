"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";

/** Copies a link, and says so for two seconds. */
export function CopyButton({
  value,
  label = "Copy",
  size,
}: {
  value: string;
  label?: string;
  size?: "sm" | "default";
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Select the link and copy it manually.");
    }
  }

  return (
    <Button variant="outline" size={size} onClick={() => void copy()}>
      {copied ? (
        <Check className="size-4" aria-hidden />
      ) : (
        <Copy className="size-4" aria-hidden />
      )}
      {copied ? "Copied" : label}
    </Button>
  );
}
