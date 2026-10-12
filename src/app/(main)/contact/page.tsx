import ContactPage from "./Contact";
import { pageMetadata } from "~/lib/seo-constants";

export const metadata = pageMetadata({
  title: "Contact",
  description:
    "Bookings, collabs, questions. Get in touch with Atmos by message, phone or email.",
  path: "/contact",
});

export default function Page() {
  return <ContactPage />;
}
