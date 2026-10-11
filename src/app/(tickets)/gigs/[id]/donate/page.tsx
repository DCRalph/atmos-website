import { type Metadata } from "next";
import { notFound } from "next/navigation";

import { DonatePage } from "~/components/site/gigs/donate-page";
import { donateGig, paidDonationCents } from "~/server/donations";

/**
 * A gig's donate page, behind the Donate button on the gig page. In the bare
 * (tickets) layout like photo signup: the poster fills the screen, one panel
 * asks. Stripe Checkout sends people back here with `?session_id=`, which
 * turns the ask into a thank you. Dynamic, since that changes per visit.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata(
  props: PageProps<"/gigs/[id]/donate">,
): Promise<Metadata> {
  const gig = await donateGig((await props.params).id);
  return { title: gig ? `Donate | ${gig.title}` : "Gig not found" };
}

export default async function Page(props: PageProps<"/gigs/[id]/donate">) {
  const [{ id }, query] = await Promise.all([props.params, props.searchParams]);
  const gig = await donateGig(id);
  if (!gig) notFound();

  const sessionId =
    typeof query.session_id === "string" ? query.session_id : null;
  const thankedCents = sessionId
    ? await paidDonationCents(sessionId, gig.id)
    : null;

  return <DonatePage gig={gig} thankedCents={thankedCents} />;
}
