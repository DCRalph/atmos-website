"use client";

import Link from "next/link";
import { Button, buttonVariants } from "./ui";
import { SiteMessage } from "./site-message";

/** The error screen for public pages. `retry` fetches and renders the segment that broke again. */
export function SiteError({ retry }: { retry: () => void }) {
  return (
    <SiteMessage
      title="That didn't load"
      body="Something broke on our side. Try again, and if it keeps happening, let us know."
    >
      <Button onClick={retry}>Try again</Button>
      <Link href="/contact" className={buttonVariants({ variant: "outline" })}>
        Contact us
      </Link>
    </SiteMessage>
  );
}
