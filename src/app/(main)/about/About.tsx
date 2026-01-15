"use client";

import Image from "next/image";
import Link from "next/link";

export default function AboutPage() {
  // useEffect(() => {
  //   setForcedTheme("light");
  //   return () => {
  //     setForcedTheme(undefined);
  //   };
  // }, [setForcedTheme]);

  return (
    <main className=" isolate min-h-dvh bg-black text-black">
      {/* Dark frame background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <Image
          src="/home/atmos-2.jpg"
          alt=""
          fill
          priority
          className="object-cover opacity-40 grayscale"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-black/65" />
        <div className="absolute inset-0 bg-radial from-white/10 via-transparent to-transparent" />
      </div>

      <section className="relative z-10 mx-auto w-full max-w-[1160px] px-4 py-10 sm:py-14">
        <div className="relative overflow-hidden bg-white shadow-2xl ring-1 ring-black/15">
          {/* Watermark year */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-10 top-40 select-none text-[clamp(6rem,20vw,16rem)] font-black leading-none tracking-[-0.08em] text-black/5"
          >
            2026
          </div>

          {/* Poster top micro-nav */}


          <div className="flex justify-center px-6 py-5 sm:px-10 sm:py-6">
            <Link
              href="/"
              className="text-xs font-semibold tracking-[0.38em] text-black"
            >
              ATMOS
            </Link>
          </div>




          {/* Hero headline */}
          <div className="px-6 sm:px-10">
            <h1 className="text-balance pt-2 text-center text-[clamp(3.4rem,10.5vw,8.8rem)] font-black leading-[0.82] tracking-[-0.065em] text-black transform-[scaleX(0.88)]">
              OUR VISION
            </h1>

            <div className="mt-3 grid grid-cols-3 items-start gap-3 text-[10px] font-medium tracking-[0.22em] text-black/70">
              <p className="uppercase">Underground energy</p>
              <p className="text-center uppercase">Community first</p>
              <p className="text-right uppercase">Aotearoa sound</p>
            </div>
          </div>

          {/* Main poster body */}
          <div className="grid grid-cols-12 gap-6 px-6 pb-8 pt-10 sm:gap-8 sm:px-10 sm:pb-10">
            <div className="col-span-12 sm:col-span-7 flex flex-col gap-6">
              <h2 className="text-left text-[clamp(1.9rem,4.2vw,3.3rem)] font-black leading-[0.9] tracking-[-0.05em] text-black transform-[scaleX(0.92)]">
                MODERN
                <br />
                RAVE CULTURE
              </h2>

              <div className="mt-5 w-full max-w-[520px] overflow-hidden ring-1 ring-black/10">
                <div className="relative aspect-video w-full">
                  <Image
                    src="/home/atmos-1.jpg"
                    alt="ATMOS event crowd"
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 92vw, 520px"
                  />
                </div>
              </div>

              <p className="mt-4 max-w-[54ch] text-[13px] leading-relaxed tracking-[0.02em] text-black/70">
                ATMOS is a collective of DJs, producers, and creatives based in Pōneke /
                Wellington. We build nights that feel cinematic: tight curation, bold
                sound, and a room that moves as one.
              </p>

              <div className="mt-5 w-full max-w-[360px] overflow-hidden ring-1 ring-black/10">
                <div className="relative aspect-4/3 w-full">
                  <Image
                    src="/home/atmos-6.jpg"
                    alt="ATMOS moment"
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 80vw, 360px"
                  />
                </div>
              </div>
            </div>

            <div className="col-span-12 sm:col-span-5 flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-black/60">
                  <p className="mb-2">ATMOS</p>
                  <p className="text-black/70">Mixes subtly formal + raw.</p>
                </div>
                <div className="text-right text-[10px] font-medium uppercase tracking-[0.22em] text-black/60">
                  <p className="mb-2">We aim</p>
                  <p className="text-black/70">for intention over noise.</p>
                </div>
              </div>

              <div className="mx-auto w-full max-w-[260px] overflow-hidden ring-1 ring-black/10 sm:mx-0 sm:ml-auto">
                <div className="relative aspect-2/3 w-full">
                  <Image
                    src="/home/atmos-2.jpg"
                    alt="Artist portrait at ATMOS"
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 70vw, 260px"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-black/60">
                  <p className="mb-2">Production</p>
                  <p className="text-black/70">Traceable by design.</p>
                </div>
                <div className="text-right text-[10px] font-medium uppercase tracking-[0.22em] text-black/60">
                  <p className="mb-2">Respect</p>
                  <p className="text-black/70">for people + place.</p>
                </div>
              </div>

              <div className="grid gap-2 text-[13px] leading-relaxed tracking-[0.02em] text-black/60">
                <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-black/60">
                  Notes
                </p>
                <p>
                  Placeholder text: Duis aute irure dolor in reprehenderit in
                  voluptate velit esse cillum dolore eu fugiat nulla pariatur.
                </p>
              </div>
            </div>
          </div>

          {/* Bottom statement + cutout */}
          <div className="relative px-6 pb-10 sm:px-10">
            <div className="flex items-end justify-between gap-6">
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-black/60">
                Since 1BK
              </p>
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-black/60">
                Pōneke, Aotearoa
              </p>
            </div>

            <div className="mt-5 grid gap-3 text-[13px] leading-relaxed tracking-[0.02em] text-black/60 sm:max-w-[72ch]">
              <p>
                Placeholder text: Excepteur sint occaecat cupidatat non proident, sunt
                in culpa qui officia deserunt mollit anim id est laborum.
              </p>
              <p>
                Placeholder text: Curabitur non nulla sit amet nisl tempus convallis
                quis ac lectus. Vivamus suscipit tortor eget felis porttitor volutpat.
              </p>
            </div>
          </div>


        </div>
      </section>
    </main>
  );
}