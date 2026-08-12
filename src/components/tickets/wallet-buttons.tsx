import Image from "next/image";
import { Wallet } from "lucide-react";

/**
 * Wallet badges.
 *
 * Apple's badge is artwork, not a button we style: it has a fixed lockup, a
 * minimum size, and required clear space, and the guidelines are explicit that
 * it must not be redrawn, recoloured or relabelled. So the anchor here adds
 * nothing but a hit target, and the file it points at is Apple's own artwork,
 * unmodified and under its original name — which also records the locale and
 * revision it came from.
 *
 * @see https://developer.apple.com/wallet/add-to-apple-wallet-guidelines/
 */

/** Apple's artwork, at its intrinsic size. */
const APPLE_BADGE = {
  src: "/US-UK_Add_to_Apple_Wallet_RGB_101421.svg",
  width: 110.739,
  height: 35.016,
} as const;

export function AddToAppleWalletButton({ href }: { href: string }) {
  return (
    <a
      href={href}
      aria-label="Add to Apple Wallet"
      // The padding is the badge's required clear space — at least 1/10 of its
      // height on every side, kept as real space rather than trusting the
      // surrounding gap.
      className="inline-block rounded-[10px] p-1 transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
    >
      <Image
        src={APPLE_BADGE.src}
        alt="Add to Apple Wallet"
        // Intrinsic dimensions, with the display size set in CSS on one axis
        // only: Apple forbids distorting the badge, and rounding a computed
        // pixel height is exactly how that happens.
        width={Math.round(APPLE_BADGE.width)}
        height={Math.round(APPLE_BADGE.height)}
        className="h-[42px] w-auto"
        unoptimized
      />
    </a>
  );
}

/**
 * Google's equivalent has its own badge programme and its own artwork rules.
 * Until that artwork is in place this stays a plain link rather than a
 * home-made imitation of it.
 */
export function AddToGoogleWalletButton({ href }: { href: string }) {
  return (
    <a
      href={href}
      className="inline-flex h-[42px] items-center gap-2 rounded-[10px] border border-white/20 px-4 text-sm text-white/80 transition-colors hover:bg-white hover:text-black"
    >
      <Wallet className="size-4" aria-hidden />
      Add to Google Wallet
    </a>
  );
}
