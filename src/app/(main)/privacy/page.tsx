import PrivacyPage from "./Privacy";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
};

export default function page() {
  return (
    <PrivacyPage />
  );
}