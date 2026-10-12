import SocialsPage from "./Socials";
import { pageMetadata } from "~/lib/seo-constants";

export const metadata = pageMetadata({
  title: "Socials",
  description:
    "Gig drops, sets and clips. Atmos on Instagram, TikTok, YouTube, SoundCloud, Spotify and Facebook.",
  path: "/socials",
});

export default function Page() {
  return <SocialsPage />;
}
