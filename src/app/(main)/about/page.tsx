import AboutPage from "./About";
import { BreadcrumbJsonLd } from "~/components/seo/json-ld";
import { pageMetadata } from "~/lib/seo-constants";

export const metadata = pageMetadata({
  title: "About",
  description:
    "ATMOS is an electronic music promoter and collective. We curate underground club nights and immersive DJ events.",
  path: "/about",
});

export default function Page() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "About", url: "/about" },
        ]}
      />
      <AboutPage />
    </>
  );
}
