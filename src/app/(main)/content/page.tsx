import ContentPage from "./Content";
import { pageMetadata } from "~/lib/seo-constants";
import { api, HydrateClient } from "~/trpc/server";

export const metadata = pageMetadata({
  title: "Content",
  description: "Releases, mixes and highlights from the Atmos community.",
  path: "/content",
});

export default async function Page() {
  await api.content.getAll.prefetch();

  return (
    <HydrateClient>
      <ContentPage />
    </HydrateClient>
  );
}
