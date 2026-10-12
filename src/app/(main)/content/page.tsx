import ContentPage from "./Content";
import { pageMetadata } from "~/lib/seo-constants";

export const metadata = pageMetadata({
  title: "Content",
  description: "Releases, mixes and highlights from the Atmos community.",
  path: "/content",
});

export default function Page() {
  return <ContentPage />;
}
