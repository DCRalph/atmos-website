"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteShell } from "~/components/site/site-shell";
import { SiteMessage } from "~/components/site/site-message";
import { buttonVariants } from "~/components/site/ui";

/** Every unknown address, and every `notFound()`, in the site's own clothes. */
export default function NotFound() {
  return (
    <SiteShell padTop>
      <SiteMessage
        title="Nothing here"
        body="The link might be old or mistyped. The next night is one click away."
      >
        <Link href="/gigs" className={buttonVariants({ variant: "solid" })}>
          Upcoming gigs <ArrowRight className="size-4" />
        </Link>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Home
        </Link>
      </SiteMessage>
    </SiteShell>
  );
}
