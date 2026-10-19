import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";

/**
 * The label and value lines the order and donation dialogs are made of. Put
 * them in a `<dl>`.
 */
export function DetailRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

/** A link out of the admin, to Stripe or a receipt, in a new tab. */
export function ExternalAnchor({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
    >
      {children} <ExternalLink className="size-3" />
    </a>
  );
}
