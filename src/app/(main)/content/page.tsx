import ContentPage from "./Content";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Content",
};

export default function page() {
  return <ContentPage />;
}
