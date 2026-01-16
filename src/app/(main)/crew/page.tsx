import CrewPage from "./Crew";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Crew",
};

export default function page() {
  return <CrewPage />;
}
