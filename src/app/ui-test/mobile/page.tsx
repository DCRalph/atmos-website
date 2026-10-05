import { notFound } from "next/navigation";
import { type Metadata } from "next";
import { MobileBoard } from "./board";

/**
 * Mock board for bringing the mobile app onto the public site's design
 * system: three directions, every main screen, in iPhone-sized frames.
 *
 * Open `http://localhost:3000/ui-test/mobile` while `next dev` is running.
 * Not reachable in production.
 */
export const metadata: Metadata = {
  title: "App mocks",
  robots: { index: false, follow: false },
};

export default function MobileMocksPage() {
  if (process.env.NODE_ENV === "production") return notFound();
  return <MobileBoard />;
}
