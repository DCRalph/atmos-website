"use client";

import { AfterNightWizard } from "./after-night-wizard";
import { ArtistWizard } from "./artist-wizard";
import { ChangeTicketWizard } from "./change-ticket-wizard";
import { CompGroupWizard } from "./comp-group-wizard";
import { GoToDoorWizard } from "./go-to-door-wizard";
import { MakeCodeWizard } from "./make-code-wizard";
import { ShortLinkWizard } from "./short-link-wizard";
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
import { TicketTypesWizard } from "./ticket-types-wizard";

/** Each wizard's component, by its key in the catalog. A new key fails here until it has one. */
const COMPONENTS: Record<WizardKey, () => React.ReactNode> = {
  lineup: LineupWizard,
  poster: PosterWizard,
  "gig-basics": GigBasicsWizard,
  "new-gig": NewGigWizard,
  announce: AnnounceWizard,
  "after-night": AfterNightWizard,
  "sell-tickets": SellTicketsWizard,
  "ticket-types": TicketTypesWizard,
  "event-basics": EventBasicsWizard,
  "guest-list": GuestListWizard,
  "door-staff": DoorStaffWizard,
  "make-code": MakeCodeWizard,
  "comp-group": CompGroupWizard,
  "go-to-door": GoToDoorWizard,
  "change-ticket": ChangeTicketWizard,
  artist: ArtistWizard,
  "short-link": ShortLinkWizard,
};

export function Wizard({ wizard }: { wizard: WizardKey }) {
  const Component = COMPONENTS[wizard];
  return <Component />;
}
