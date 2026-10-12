import LifetimePassPage from "./lifetime-client";
import { unlistedPageMetadata } from "~/lib/seo-constants";

export const metadata = unlistedPageMetadata(
  "Your lifetime pass",
  "Your pass to every Atmos event.",
);

export default function Page() {
  return <LifetimePassPage />;
}
