"use client";

import { useEffect } from "react";
import Image from "next/image";
import { useThemeOverride } from "~/components/theme-overide-provider";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import Link from "next/link";
// import { Separator } from "~/components/ui/separator";

// Optional: simple container utility if you don't already have one
function Container({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 md:px-8">{children}</div>;
}

export default function AboutPage() {
  const { setForcedTheme } = useThemeOverride();

  useEffect(() => {
    setForcedTheme("light");
    return () => {
      setForcedTheme(undefined);
    };
  }, [setForcedTheme]);

  return (
    <main className="bg-white text-black">
      {/* Background accents */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-linear-to-tr from-indigo-300 via-fuchsia-300 to-cyan-200 blur-3xl opacity-40" />
        <div className="absolute bottom-0 right-0 h-64 w-64 translate-x-16 translate-y-16 rounded-full bg-linear-to-tr from-cyan-200 via-emerald-200 to-lime-200 blur-3xl opacity-40" />
      </div>


      {/* Hero */}
      <section className="relative z-10 pt-16 sm:pt-24">
        <Container>
          <div className="text-center">
            <Badge variant="destructive" className="mb-4 rounded-full px-3 py-1">
              Pōneke / Wellington, Aotearoa
            </Badge>
            <h1 className="text-balance text-5xl font-extrabold tracking-tight sm:text-6xl md:text-7xl">
              WTF is ATMOS
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-pretty text-base text-gray-600 sm:text-lg">
              A collective of DJs, producers, and creatives pushing electronic music
              forward through events, collaborations, and community.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <Link href="/contact">
                <Button size="lg" className="rounded-xl">
                  Get in touch
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="rounded-xl">
                Upcoming events
              </Button>
            </div>
          </div>
        </Container>
        <div className="mt-10">
          <Container>
            <div className="relative mx-auto aspect-21/9 w-full overflow-hidden rounded-2xl ring-1 ring-black/10">
              <Image
                src="/home/atmos-1.jpg"
                alt="ATMOS event hero"
                fill
                priority
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 1200px"
              />
            </div>
          </Container>
        </div>
      </section>

      {/* Content sections */}
      <section className="relative z-10 py-16 sm:py-24">
        <Container>
          <div className="grid grid-cols-1 gap-8 md:gap-10">
            {/* Our Story */}
            <Card className="overflow-hidden border-gray-200">
              <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2">
                <div className="order-2 md:order-1">
                  <CardHeader className="pb-0">
                    <CardTitle className="text-3xl sm:text-4xl">Our Story</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <p className="mb-4 text-base leading-relaxed text-gray-700 sm:text-lg">
                      ATMOS is a collective of DJs, producers, and creatives based
                      in Pōneke (Wellington), New Zealand. We’re dedicated to pushing
                      the boundaries of electronic music and creating unforgettable
                      experiences for our community.
                    </p>
                    <p className="text-base leading-relaxed text-gray-700 sm:text-lg">
                      From underground warehouse parties to curated events, we bring
                      together the best talent in the scene to deliver nights that
                      resonate long after the music stops.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-2">
                      <Badge variant="outline">Warehouse</Badge>
                      <Badge variant="outline">Curated</Badge>
                      <Badge variant="outline">Community</Badge>
                    </div>
                  </CardContent>
                </div>
                <div className="order-1 md:order-2">
                  <div className="relative h-full min-h-72 overflow-hidden md:min-h-full">
                    <div className="relative aspect-4/3 w-full overflow-hidden md:h-full md:aspect-auto">
                      <Image
                        src="/home/atmos-1.jpg"
                        alt="ATMOS event"
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Separator accent */}
            {/* <div className="mx-auto my-2 w-full">
              <Separator />
            </div> */}

            {/* Our Mission */}
            <Card className="overflow-hidden border-gray-200">
              <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2">
                <div className="order-2">
                  <CardHeader className="pb-0">
                    <CardTitle className="text-3xl sm:text-4xl">Our Mission</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <p className="mb-4 text-base leading-relaxed text-gray-700 sm:text-lg">
                      We believe in the power of music to bring people together. Our
                      mission is to create spaces where artists can express themselves
                      freely and where audiences can discover new sounds and
                      experiences.
                    </p>
                    <p className="text-base leading-relaxed text-gray-700 sm:text-lg">
                      Through our events and collaborations, we aim to elevate the
                      electronic music scene in Aotearoa and connect with like-minded
                      communities around the world.
                    </p>
                  </CardContent>
                </div>
                <div className="order-1 md:order-2">
                  <div className="relative h-full min-h-72 overflow-hidden md:min-h-full">
                    <div className="relative aspect-4/3 w-full overflow-hidden md:h-full md:aspect-auto">
                      <Image
                        src="/home/atmos-2.jpg"
                        alt="ATMOS collective"
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Card>



            {/* Join The Movement */}
            <Card className="overflow-hidden border-gray-200">
              <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2">
                <div className="order-2 md:order-1">
                  <div className="relative h-full min-h-72 overflow-hidden md:min-h-full">
                    <div className="relative aspect-4/3 w-full overflow-hidden md:h-full md:aspect-auto">
                      <Image
                        src="/home/atmos-6.jpg"
                        alt="Join ATMOS"
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                    </div>
                  </div>
                </div>
                <div className="order-1 md:order-2">
                  <CardHeader className="pb-0">
                    <CardTitle className="text-3xl sm:text-4xl">
                      Join The Movement
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <p className="text-base leading-relaxed text-gray-700 sm:text-lg">
                      Whether you’re an artist looking to collaborate, a venue
                      interested in hosting an event, or simply someone who loves good
                      music, we’d love to hear from you. Get in touch and let’s create
                      something special together.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <Button className="rounded-xl">Contact us</Button>
                      <Button variant="outline" className="rounded-xl">
                        Collaborate
                      </Button>
                    </div>
                  </CardContent>
                </div>
              </div>
            </Card>
          </div>
        </Container>
      </section>
    </main>
  );
}