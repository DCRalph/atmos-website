"use client";

import { StaticBackground } from "~/components/static-background";
import Link from "next/link";
import { ContactForm } from "~/components/contact/contact-form-2";
import { AnimatedPageHeader } from "~/components/animated-page-header";
import { links } from "~/app/(main)/socials/Socials";
import { MainPageSection } from "~/components/main-page-section";

export default function ContactPage() {
  return (
    <main className="min-h-content bg-black text-white">
      <StaticBackground imageSrc="/home/CAGED 2-95.jpg" />

      <MainPageSection className="px-4 pt-4" containerClassName="container mx-auto">
        <AnimatedPageHeader
          title="HIT US UP"
          subtitle="Bookings, collabs, questions—send us a message"
        />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="grid grid-cols-1 content-start gap-6">
            <InstagramDM />
            <ProfessionalEnquiries />
          </div>

          <div className="hover:border-accent-muted/50 border-2 border-white/10 bg-black/80 p-6 backdrop-blur-sm transition-all hover:shadow-[0_0_20px_var(--accent-muted)] sm:p-8 md:p-10">
            <h2 className="border-accent-strong mb-6 border-l-4 pl-4 text-xl font-bold tracking-[0.15em] uppercase sm:text-2xl md:text-3xl">
              Drop us a line
            </h2>
            <ContactForm />
          </div>
        </div>
      </MainPageSection>
    </main>
  );
}

function ProfessionalEnquiries() {
  return (
    <div className="hover:border-accent-muted/50 h-fit border-2 border-white/10 bg-black/80 p-6 backdrop-blur-sm transition-all hover:shadow-[0_0_20px_var(--accent-muted)] sm:p-8">
      <h2 className="border-accent-strong mb-4 border-l-4 pl-4 text-xl font-bold tracking-[0.15em] uppercase sm:text-2xl">
        Professional Enquiries
      </h2>
      <p className="mb-6 text-sm leading-relaxed text-white/70 sm:text-base">
        For agencies, promoters, brands, venues, and other professional
        enquiries.
      </p>
      <div className="flex flex-col gap-3 text-sm sm:text-base">
        <div className="flex gap-2">
          <span className="font-bold tracking-wider uppercase">Contact:</span>
          <span className="font-mono">Finn</span>
        </div>
        <div className="flex gap-2">
          <span className="font-bold tracking-wider uppercase">Phone:</span>
          <a
            href="tel:+64274726850"
            className="hover:text-accent-muted font-mono transition-colors"
          >
            +64 27 472 6850
          </a>
        </div>
        <div className="flex gap-2">
          <span className="font-bold tracking-wider uppercase">Email:</span>
          <a
            href="mailto:finn@atmos-wlg.com"
            className="hover:text-accent-muted font-mono break-all transition-colors"
          >
            finn@atmos-wlg.com
          </a>
        </div>
      </div>
    </div>
  );
}

function InstagramDM() {
  return (
    <div className="hover:border-accent-muted/50 border-2 border-white/10 bg-black/80 p-6 text-center backdrop-blur-sm transition-all hover:shadow-[0_0_20px_var(--accent-muted)] sm:p-8">
      <h2 className="border-accent-strong mb-4 border-l-4 pl-4 text-left text-2xl font-bold tracking-[0.15em] uppercase">
        Instagram DM
      </h2>
      <p className="text-left leading-relaxed text-white/70">
        For the quickest response, send us a direct message at{" "}
        <Link
          href={links.instagram}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-accent-muted font-bold transition-colors"
        >
          @atmos.nz
        </Link>
        .
      </p>
    </div>
  );
}
