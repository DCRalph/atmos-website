import { type Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PhotoSignupPage } from "~/components/site/gigs/photo-signup-page";
import { photoSignupGig } from "~/server/photo-signup";

/**
 * Where a gig's venue QR codes land, through its short link: leave an email,
 * hear when the photos are up. In the bare (tickets) layout, so the poster
 * fills the screen with no header in the way.
 *
 * Once the gig has photos it skips the ask and goes straight to its gallery,
 * since the codes stay stuck to walls long after the night. Dynamic, because
 * `?c=` (which QR code) and whether the photos are out both change.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata(
  props: PageProps<"/gigs/[id]/photo-signup">,
): Promise<Metadata> {
  const gig = await photoSignupGig((await props.params).id);
  return { title: gig ? `Photos | ${gig.title}` : "Gig not found" };
}

export default async function Page(
  props: PageProps<"/gigs/[id]/photo-signup">,
) {
  const [{ id }, query] = await Promise.all([props.params, props.searchParams]);
  const gig = await photoSignupGig(id);
  if (!gig) notFound();
  if (gig.hasPhotos) redirect(gig.galleryHref);

  const code = typeof query.c === "string" ? query.c : null;
  return <PhotoSignupPage gig={gig} code={code} />;
}
