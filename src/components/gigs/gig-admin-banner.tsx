"use client";

import { api } from "~/trpc/react";
import { gigOffSiteNotice } from "~/lib/gig-visibility";
import { cn } from "~/lib/utils";

type GigLike = Parameters<typeof gigOffSiteNotice>[0];

/**
 * The strip that says why an admin is looking at a gig the public is not.
 *
 * Renders nothing for everybody else, and nothing for a gig that is on the
 * public site, so it can sit unconditionally at the top of any gig card. The
 * viewer lookup is one shared query: every card on the page reads the same
 * cache entry.
 */
export function GigAdminBanner({
  gig,
  className,
}: {
  gig: GigLike;
  className?: string;
}) {
  const { data: viewer } = api.user.me.useQuery();
  const isAdmin = viewer?.effectivePermissions.includes("ADMIN") ?? false;
  if (!isAdmin) return null;

  const notice = gigOffSiteNotice(gig);
  if (!notice) return null;

  return (
    <div
      className={cn(
        "bg-amber-400 px-3 py-1 text-center text-[10px] font-black tracking-wider text-black uppercase",
        className,
      )}
    >
      {notice}
    </div>
  );
}
