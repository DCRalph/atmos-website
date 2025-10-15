import { ImageCycleBackground } from "~/app/_components/image-cycle-background";
import Link from "next/link";

export default function ContactPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <ImageCycleBackground intervalMs={5000} auto={true} />

      <section className="relative z-10 min-h-screen px-4 py-24">
        <div className="mx-auto max-w-3xl">
          <div className="mb-12">
            <Link href="/" className="text-white/60 hover:text-white transition-colors">
              ← Back
            </Link>
          </div>

          <h1 className="mb-8 text-center text-5xl font-bold tracking-wider md:text-7xl">
            HIT US UP
          </h1>

          <p className="mb-12 text-center text-lg text-white/60">
            Got a booking inquiry, collaboration idea, or just want to say hi? Drop us a
            line below.
          </p>

          <div className="rounded-lg border border-white/10 bg-white/5 p-8 backdrop-blur-sm md:p-12">
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

          <div className="mt-12 text-center">
            <h2 className="mb-4 text-2xl font-bold">Other Ways to Reach Us</h2>
            <div className="space-y-2 text-white/60">
              <p>
                Email:{" "}
                <a href="mailto:hello@atmos.com" className="text-white hover:underline">
                  hello@atmos.com
                </a>
              </p>
              <p>
                Bookings:{" "}
                <a
                  href="mailto:bookings@atmos.com"
                  className="text-white hover:underline"
                >
                  bookings@atmos.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

