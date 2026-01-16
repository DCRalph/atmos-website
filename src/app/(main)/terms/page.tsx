import TermsPage from "./Terms";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms",
};

export default function page() {
  return <TermsPage />;
}
