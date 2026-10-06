import { Download } from "lucide-react";

import { Button } from "~/components/ui/button";

/**
 * Where a link's QR code downloads from, encoding the link on `host`. `code`
 * picks a named one.
 */
export function qrHref(
  linkId: string,
  host: string,
  format: "svg" | "png",
  code?: string,
): string {
  const query = new URLSearchParams({
    format,
    host,
    ...(code ? { code } : {}),
  });
  return `/api/admin/short-links/${linkId}/qr?${query}`;
}

/** SVG for print, PNG for everything else. */
export function QrDownloadButtons({
  linkId,
  host,
  code,
}: {
  linkId: string;
  host: string;
  code?: string;
}) {
  return (
    <>
      <Button variant="outline" size="sm" asChild>
        <a href={qrHref(linkId, host, "svg", code)} download>
          <Download className="size-4" aria-hidden /> SVG
        </a>
      </Button>
      <Button variant="outline" size="sm" asChild>
        <a href={qrHref(linkId, host, "png", code)} download>
          <Download className="size-4" aria-hidden /> PNG
        </a>
      </Button>
    </>
  );
}
