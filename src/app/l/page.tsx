import LinksPage from "./links-client";
import { unlistedPageMetadata } from "~/lib/seo-constants";

// The link in bio: shared everywhere, but the same content as the home page
// and /socials, so it stays out of search.
export const metadata = unlistedPageMetadata(
  "Links",
  "Upcoming gigs and everywhere to find Atmos.",
);

export default function Page() {
  return <LinksPage />;
}
