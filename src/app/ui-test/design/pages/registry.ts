import type { PageSpec } from "./types";
import { gigsPage } from "./gigs";
import { homeLivePage } from "./home-live";
import { gigDetailPage } from "./gig-detail";
import { eventsPage } from "./events";
import { eventPage } from "./event";
import { contentPage } from "./content";
import { crewPage } from "./crew";
import { merchPage } from "./merch";
import { merchProductPage } from "./merch-product";
import { socialsPage } from "./socials";
import { contactPage } from "./contact";
import { aboutPage } from "./about";
import { equipmentPage } from "./equipment";
import { legalPage } from "./legal";

/** Every `(main)` page, in the order they appear in the Pages picker. */
export const pageSpecs: readonly PageSpec[] = [
  homeLivePage,
  gigsPage,
  gigDetailPage,
  eventsPage,
  eventPage,
  contentPage,
  crewPage,
  merchPage,
  merchProductPage,
  socialsPage,
  contactPage,
  aboutPage,
  equipmentPage,
  legalPage,
];

export const findPage = (id: string | undefined) =>
  pageSpecs.find((p) => p.id === id) ?? pageSpecs[0]!;
