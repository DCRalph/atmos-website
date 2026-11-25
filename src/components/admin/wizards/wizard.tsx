"use client";

import { AfterNightWizard } from "./after-night-wizard";
import { AnnounceWizard } from "./announce-wizard";
import type { WizardKey } from "./catalog";
import { DoorStaffWizard } from "./door-staff-wizard";
import { EventBasicsWizard } from "./event-basics-wizard";
import { GigBasicsWizard } from "./gig-basics-wizard";
import { GuestListWizard } from "./guest-list-wizard";
import { LineupWizard } from "./lineup-wizard";
import { NewGigWizard } from "./new-gig-wizard";
import { PosterWizard } from "./poster-wizard";
import { SellTicketsWizard } from "./sell-tickets-wizard";
import { TicketPricesWizard } from "./ticket-prices-wizard";

/** Each wizard's component, by its key in the catalog. A new key fails here until it has one. */
const COMPONENTS: Record<WizardKey, () => React.ReactNode> = {
  lineup: LineupWizard,
  poster: PosterWizard,
  "gig-basics": GigBasicsWizard,
  "new-gig": NewGigWizard,
  announce: AnnounceWizard,
  "after-night": AfterNightWizard,
  "sell-tickets": SellTicketsWizard,
  "ticket-prices": TicketPricesWizard,
  "event-basics": EventBasicsWizard,
  "guest-list": GuestListWizard,
  "door-staff": DoorStaffWizard,
};

export function Wizard({ wizard }: { wizard: WizardKey }) {
  const Component = COMPONENTS[wizard];
  return <Component />;
}
