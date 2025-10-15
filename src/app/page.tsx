// import { AnimatedTitle } from "~/app/_components/animated-title";
import { OpeningAnimation } from "~/app/_components/opening-animation";
// import { Background } from "~/app/_components/background";
// import { TopRightBadge } from "~/app/_components/top-right-badge";
// import { PopSidesBackground } from "~/app/_components/pop-sides-background";
import { ImageCycleBackground } from "~/app/_components/image-cycle-background";
import { EmailPopup } from "~/app/_components/email-popup";

import Image from "next/image";



export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <EmailPopup />
      <OpeningAnimation />
      {/* <Background /> */}
      <ImageCycleBackground intervalMs={5000} auto={true} />
      {/* <PopSidesBackground /> */}

      {/* Top-right Atmos badge */}
      {/* <div className="absolute right-6 top-6 z-20">
        <TopRightBadge />
      </div> */}

      {/* Centered title */}
      <section className="relative z-10 flex min-h-screen items-center justify-center px-4">
        <div className="text-center w-full max-w-[90vw] sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl">
          {/* <AnimatedTitle text="ATMOS" /> */}

          <div className="relative w-full aspect-[4/1]">
            <Image src="/logo/atmos-white.png" alt="Atmos Logo" fill className="object-contain" />
          </div>
        </div>
      </section>
    </main>
  );
}
