import MerchPage from "./Merch";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Merch",
};

export default function page() {
  return <MerchPage />;
}
