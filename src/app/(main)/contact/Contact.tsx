"use client"

import { StaticBackground } from "~/components/static-background"
import Link from "next/link"
import { ContactForm } from "~/components/contact/contact-form-2"
import { AnimatedPageHeader } from "~/components/animated-page-header"

export default function ContactPage() {
  return (
    <main className="bg-black text-white">
      <StaticBackground imageSrc="/home/CAGED 2-95.jpg" />

      <section className="relative z-10 min-h-dvh px-4 py-16 sm:py-24">
        <div className="mx-auto container">
          <AnimatedPageHeader
            title="HIT US UP"
            subtitle="Bookings, collabs, questions—send us a message"
          />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="grid grid-cols-1 gap-6 content-start">
              <InstagramDM />
              <ProfessionalEnquiries />
            </div>


            <div className="border-2 border-white/10 bg-black/80 backdrop-blur-sm p-6 sm:p-8 md:p-10 hover:border-accent-muted/50 hover:shadow-[0_0_20px_var(--accent-muted)] transition-all">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-6 tracking-[0.15em] uppercase border-l-4 border-accent-strong pl-4">
                Drop us a line
              </h2>
              <ContactForm />
            </div>


          </div>
        </div>
      </section>
    </main>
  )
}

function ProfessionalEnquiries() {
  return (
    <div className="border-2 border-white/10 bg-black/80 backdrop-blur-sm p-6 sm:p-8 h-fit hover:border-accent-muted/50 hover:shadow-[0_0_20px_var(--accent-muted)] transition-all">
      <h2 className="text-xl sm:text-2xl font-bold mb-4 tracking-[0.15em] uppercase border-l-4 border-accent-strong pl-4">
        Professional Enquiries
      </h2>
      <p className="mb-6 text-white/70 text-sm sm:text-base leading-relaxed">
        For agencies, promoters, brands, venues, and other professional enquiries.
      </p>
      <div className="flex flex-col gap-3 text-sm sm:text-base">
        <div className="flex gap-2">
          <span className="font-bold uppercase tracking-wider">Contact:</span>
          <span className="font-mono">Finn</span>
        </div>
        <div className="flex gap-2">
          <span className="font-bold uppercase tracking-wider">Phone:</span>
          <a href="tel:+64274726850" className="hover:text-accent-muted transition-colors font-mono">
            +64 27 472 6850
          </a>
        </div>
        <div className="flex gap-2">
          <span className="font-bold uppercase tracking-wider">Email:</span>
          <a href="mailto:finn@atmos-wlg.com" className="hover:text-accent-muted transition-colors font-mono break-all">
            finn@atmos-wlg.com
          </a>
        </div>
      </div>
    </div>
  )
}

function InstagramDM() {
  return (
    <div className="text-center backdrop-blur-sm border-2 border-white/10 bg-black/80 p-6 sm:p-8 hover:border-accent-muted/50 hover:shadow-[0_0_20px_var(--accent-muted)] transition-all">
      <h2 className="mb-4 text-2xl font-bold uppercase tracking-[0.15em] border-l-4 border-accent-strong pl-4 text-left">
        Instagram DM
      </h2>
      <p className="text-white/70 leading-relaxed text-left">
        For the quickest response, send us a direct message at{" "}
        <Link
          href="https://www.instagram.com/atmos.nz"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-accent-muted font-bold transition-colors"
        >
          @atmos.nz
        </Link>
        .
      </p>
    </div>
  )
}
