import ContactPage from "./Contact";
import { pageMetadata } from "~/lib/seo-constants";

export const metadata = pageMetadata({
  title: "Contact",
  description:
    "Bookings, collabs, questions. Send Atmos a message through the contact form.",
  path: "/contact",
});

export default function Page() {
  return <ContactPage />;
}
