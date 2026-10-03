"use client";

import { HomeHero } from "./home-hero";
import { LatestContent } from "./latest-content";
import { HomeNewsletter } from "./newsletter";
import { RecentGigs } from "./recent-gigs";
import { UpcomingGigs } from "./upcoming-gigs";

/** Home page body: logo hero with the next gig docked, then the curated sections. */
export function HomePage() {
  return (
    <>
      <HomeHero />
      <UpcomingGigs />
      <LatestContent />
      <RecentGigs />
      <HomeNewsletter />
    </>
  );
}
