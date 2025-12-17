import ContactPage from "./Contact";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
};

export default function page() {
  return (
    <ContactPage />
  );
}