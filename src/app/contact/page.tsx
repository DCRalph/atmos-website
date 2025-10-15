import { ImageCycleBackground } from "~/app/_components/image-cycle-background";
import Link from "next/link";

export default function ContactPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <ImageCycleBackground intervalMs={5000} auto={true} />

      <section className="relative z-10 min-h-screen px-4 py-16 sm:py-24">

        <div className="mx-auto container">
          {/* <div className="mb-12">
            <Link href="/" className="text-white/60 hover:text-white transition-colors">
              ← Back
            </Link>
          </div> */}

          <h1 className="mb-8 text-center text-5xl font-bold tracking-wider md:text-7xl">
            HIT US UP
          </h1>




          <div className="flex justify-around gap-6 flex-col md:flex-row">
            <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-4 sm:p-6 md:p-8 ">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 text-center tracking-wide">
                Got a booking inquiry or collaboration idea. Drop us a
                line below.
              </h2>
              <form className="space-y-6">
                <div>
                  <label htmlFor="name" className="mb-2 block text-sm font-semibold">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 backdrop-blur-sm transition-all focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/30"
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-semibold">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 backdrop-blur-sm transition-all focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/30"
                    placeholder="your@email.com"
                  />
                </div>

                <div>
                  <label htmlFor="subject" className="mb-2 block text-sm font-semibold">
                    Subject
                  </label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 backdrop-blur-sm transition-all focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/30"
                    placeholder="What's this about?"
                  />
                </div>

                <div>
                  <label htmlFor="message" className="mb-2 block text-sm font-semibold">
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={6}
                    className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 backdrop-blur-sm transition-all focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/30"
                    placeholder="Tell us more..."
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-md bg-white px-6 py-3 font-semibold text-black transition-all hover:bg-white/90"
                >
                  Send Message
                </button>
              </form>
            </div>

            <div className="flex flex-col gap-6">
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