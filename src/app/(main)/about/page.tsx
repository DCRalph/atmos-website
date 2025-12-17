import AboutPage from "./About";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
};

export default function page() {
  return (
    <AboutPage />
  );
}