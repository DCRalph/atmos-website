import { redirect } from "next/navigation";

/** The old Newsletter page. Its subscribers live on the Mailouts page now. */
export default function AdminNewsletterPage() {
  redirect("/admin/mailouts?tab=subscribers");
}
