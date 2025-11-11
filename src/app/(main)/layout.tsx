import { RightMenuRail } from "~/components/right-menu-rail";
import { UserIndicator } from "~/components/user-indicator";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Top navigation scroller */}
      {/* <div className="fixed left-1/2 top-0 z-20 w-full -translate-x-1/2 max-w-2xl">
            <ScrollingText />
          </div> */}


      {/* Right menu rail */}
      <RightMenuRail className="fixed top-2 sm:top-4 right-2 sm:right-6 z-20 text-right" />

      <UserIndicator />

      {/* <ViewTransitionOverlay /> */}
      {children}
    </>
  );
}