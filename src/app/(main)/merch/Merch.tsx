"use client";

import { NewsletterPopup } from "~/components/site/newsletter-popup";
import { MerchCatalogue } from "~/components/site/merch/merch-catalogue";

export default function MerchPage() {
  return (
    <>
      <NewsletterPopup />
      <MerchCatalogue />
    </>
  );
}
