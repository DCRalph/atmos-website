// import { AnimatedTitle } from "~/app/_components/animated-title";
import { OpeningAnimation } from "~/app/_components/opening-animation";
// import { Background } from "~/app/_components/background";
// import { TopRightBadge } from "~/app/_components/top-right-badge";
// import { PopSidesBackground } from "~/app/_components/pop-sides-background";
import { VideoBackground } from "~/app/_components/video-background";
import { EmailPopup } from "~/app/_components/email-popup";
import { LiveGigPopup } from "~/app/_components/live-gig-popup";

import Image from "next/image";
import { SocialLinks } from "./_components/social-links";
import { UserIndicator } from "./_components/user-indicator";



export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      {/* <EmailPopup /> */}
      <OpeningAnimation />
      {/* <Background /> */}
      <VideoBackground />
      {/* <PopSidesBackground /> */}

      <SocialLinks className="fixed left-3 top-3 z-20" />
      <UserIndicator />
      <LiveGigPopup />


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
