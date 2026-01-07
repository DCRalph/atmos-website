"use client";

import { StaticBackground } from "~/components/static-background";
import Link from "next/link";
import { ContactForm } from "~/components/contact/contact-form";

export default function ContactPage() {
  return (
    <main className=" bg-black text-white">
      <StaticBackground imageSrc="/home/CAGED 2-95.jpg" />

      <section className="relative z-10 min-h-dvh px-4 py-16 sm:py-24">

        <div className="mx-auto container">
          <h1 className="mb-8 text-center text-5xl font-bold tracking-wider md:text-7xl">
            HIT US UP
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-4 sm:p-6 md:p-8">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 text-center tracking-wide">
                Drop us a line below.
              </h2>
              <ContactForm />
            </div>

            <div className="grid grid-cols-1 gap-6 content-start">
              <InstagramDM />
              <ProfessionalEnquiries />
            </div>
          </div>

        </div>
      </section>
    </main>
  );
}



function ProfessionalEnquiries() {
  return (
    <div className="rounded-lg border border-white/15 bg-white/5 backdrop-blur-sm p-4 sm:p-6 shadow-lg h-fit">
      <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 text-center tracking-wide">
        Professional/Industry Enquiries
      </h2>
      <p className="mb-6 text-white/80 text-center text-sm sm:text-base">
        For agencies, promoters, brands, venues, and other professional enquiries.
      </p>
      <div className="flex flex-col gap-2 sm:gap-1 items-center text-xs sm:text-sm text-center text-white/90">
        <div>
          <span className="font-semibold">Contact:</span>{" "}
          <span className="font-mono">Finn</span>
        </div>
        <div>
          <span className="font-semibold">Phone:</span>{" "}
          <a
            href="tel:+64274726850"
            className="hover:underline text-white break-all"
          >
            +64 27 472 6850
          </a>
        </div>
        <div>
          <span className="font-semibold">Email:</span>{" "}
          <a
            href="mailto:finn@atmos-wlg.com"
            className="hover:underline text-white break-all"
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
    <div className=" text-center backdrop-blur-sm rounded-lg border border-white/10 bg-white/5 p-4 sm:p-6">
      <h2 className="mb-4 text-2xl font-bold">DM Us On Instagram</h2>
      <div className="space-y-2 text-white/60">
        <p>
          For the quickest response, send us a direct message at{" "}
          <Link
            href="https://www.instagram.com/atmos.nz"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:underline"
          >
            @atmos.nz
          </Link>
          .
        </p>
      </div>
    </div>
  );
}