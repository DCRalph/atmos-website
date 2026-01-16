import GigsPage from "./Gigs";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Gigs",
};

export default function page() {
  return <GigsPage />;
}
