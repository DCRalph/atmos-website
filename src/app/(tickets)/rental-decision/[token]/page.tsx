import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TRPCError } from "@trpc/server";
import { format } from "date-fns";

import { RentalStatus } from "~Prisma/client";
import { decideRental } from "~/server/api/routers/rentals";
import { db } from "~/server/db";
import {
  TicketShell,
  outlinePillClass,
  ticketPanelClass,
} from "~/components/tickets/ticket-shell";
import { cn } from "~/lib/utils";

/**
 * Where the Approve / Deny buttons in the staff rental email land.
 *
 * The link only opens this page; the decision needs a button press. Mail
 * scanners (Outlook Safe Links and friends) follow every link in a message,
 * so a link that acted on GET would decide requests nobody looked at. The
 * token is the only credential and is cleared once a decision is made.
 */

export const metadata: Metadata = {
  title: "Rental request · Atmos",
  robots: { index: false, follow: false },
};

type Action = "approve" | "deny";

export default async function RentalDecisionPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ action?: string; done?: string; error?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const action: Action = query.action === "deny" ? "deny" : "approve";

  if (query.done === "approve" || query.done === "deny") {
    return (
      <Shell
        heading={query.done === "approve" ? "Rental approved" : "Rental denied"}
      >
        <p className="mt-4 text-[15px] leading-relaxed text-white/65">
          If they left an email, the requester has been told.
        </p>
        <AdminLink />
      </Shell>
    );
  }

  const rental = await db.rental.findUnique({
    where: { decisionToken: token },
    include: {
      gearPackage: true,
      rentalItems: { include: { gearItem: true } },
    },
  });

  if (rental?.status !== RentalStatus.PENDING) {
    return (
      <Shell heading="Link already used">
        <p className="mt-4 text-[15px] leading-relaxed text-white/65">
          This request has already been decided, or the link is wrong.
        </p>
        <AdminLink />
      </Shell>
    );
  }

  async function decide(formData: FormData) {
    "use server";
    const chosen: Action =
      formData.get("action") === "deny" ? "deny" : "approve";
    try {
      await decideRental(
        { db },
        {
          where: { decisionToken: token },
          decision:
            chosen === "approve"
              ? RentalStatus.APPROVED
              : RentalStatus.REJECTED,
        },
      );
    } catch (error) {
      // A clash on approve is the one failure worth explaining; anything
      // else means the link has gone stale, which the page already handles.
      if (error instanceof TRPCError && error.code === "BAD_REQUEST") {
        redirect(
          `/rental-decision/${token}?action=${chosen}&error=unavailable`,
        );
      }
      redirect(`/rental-decision/${token}`);
    }
    redirect(`/rental-decision/${token}?done=${chosen}`);
  }

  const gear = rental.gearPackage
    ? rental.gearPackage.name
    : rental.rentalItems
        .map((item) => `${item.quantity} × ${item.gearItem.name}`)
        .join(", ");

  const rows: [string, string][] = [
    ["Promoter", rental.userName],
    ["Email", rental.contactInfo],
    ["Gear", gear],
    [
      "Dates",
      `${format(rental.startDate, "d MMM")} to ${format(rental.endDate, "d MMM yyyy")}`,
    ],
    ["Estimated total", `$${rental.estimatedTotalPrice}`],
  ];

  return (
    <Shell heading={action === "approve" ? "Approve rental?" : "Deny rental?"}>
      <dl className={cn(ticketPanelClass, "mt-8 p-0")}>
        {rows.map(([label, value], index) => (
          <div
            key={label}
            className={`flex items-baseline justify-between gap-4 px-5 py-3 ${
              index > 0 ? "border-t border-white/10" : ""
            }`}
          >
            <dt className="text-[14px] text-white/55">{label}</dt>
            <dd className="text-right text-[14px] break-all text-white">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {query.error === "unavailable" ? (
        <p
          role="alert"
          className="mt-6 text-[14px] text-[var(--site-danger-text)]"
        >
          Some of this gear is already booked for these dates. Sort it out in
          the admin dashboard.
        </p>
      ) : null}

      <form action={decide} className="mt-8">
        <input type="hidden" name="action" value={action} />
        <button
          type="submit"
          className={cn(
            "t-label inline-flex h-14 w-full items-center justify-center rounded-full px-9 text-[13px] transition-[filter,background-color]",
            action === "approve"
              ? "bg-[var(--site-accent)] text-[var(--site-accent-ink)] hover:brightness-110"
              : "bg-[var(--site-danger)] text-black hover:brightness-110",
          )}
        >
          {action === "approve"
            ? "Approve and email requester"
            : "Deny and email requester"}
        </button>
      </form>

      <a
        href={`/rental-decision/${token}?action=${action === "approve" ? "deny" : "approve"}`}
        className="mt-4 block text-center text-[14px] text-white/55 underline underline-offset-4 hover:text-white"
      >
        {action === "approve" ? "Deny instead" : "Approve instead"}
      </a>
    </Shell>
  );
}

function Shell({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <TicketShell>
      <p className="t-label text-[11px] text-white/55">Gear rental</p>
      <h1 className="t-heading mt-3 text-[clamp(2rem,9vw,3rem)]">{heading}</h1>
      {children}
    </TicketShell>
  );
}

function AdminLink() {
  return (
    <a href="/admin/rentals" className={cn(outlinePillClass, "mt-8")}>
      Open rentals in the admin
    </a>
  );
}
