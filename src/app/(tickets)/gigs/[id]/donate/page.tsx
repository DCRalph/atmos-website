import { type Metadata } from "next";
import { notFound } from "next/navigation";

import { DonatePage } from "~/components/site/gigs/donate-page";
import { pageMetadata } from "~/lib/seo-constants";
import { donateGig, paidDonationCents } from "~/server/donations";

/**
 * A gig's donate page, behind the Donate button on the gig page. In the bare
 * (tickets) layout like photo signup: the poster above one panel that asks
 * and takes the payment in place. A payment method that leaves for its own
 * page (a bank redirect, say) comes back with `?payment_intent=`, which turns
 * the ask into a thank you. Dynamic, since that changes per visit.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata(
  props: PageProps<"/gigs/[id]/donate">,
): Promise<Metadata> {
  const gig = await donateGig((await props.params).id);
  if (!gig) return { title: "Gig not found" };
  // Shared to ask for support, so it previews as the ask, with the poster.
  return pageMetadata({
    title: `Support ${gig.title}`,
    description: `Chip in for ${gig.title}. Pay with Apple Pay, Google Pay or card.`,
    path: `${gig.gigHref}/donate`,
    image: gig.ogImage ?? undefined,
    noindex: true,
  });
}

export default async function Page(props: PageProps<"/gigs/[id]/donate">) {
  const [{ id }, query] = await Promise.all([props.params, props.searchParams]);
  const gig = await donateGig(id);
  if (!gig) notFound();

  const intentId =
    typeof query.payment_intent === "string" ? query.payment_intent : null;
  const thankedCents = intentId
    ? await paidDonationCents(intentId, gig.id)
    : null;

  return <DonatePage gig={gig} thankedCents={thankedCents} />;
}
