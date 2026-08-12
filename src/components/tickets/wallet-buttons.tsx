import Image from "next/image";
import { Wallet } from "lucide-react";

/**
 * Wallet badges.
 *
 * Apple's badge is artwork, not a button we style: it has a fixed lockup, a
 * minimum size, and required clear space, and the guidelines are explicit that
 * it should not be redrawn, recoloured or relabelled. So the anchor here adds
 * nothing but a hit target — the badge is an image, swapped by replacing
 * `public/wallet/add-to-apple-wallet.svg` with Apple's official file.
 *
 * @see https://developer.apple.com/wallet/add-to-apple-wallet-guidelines/
 */

/** Apple's stated minimum for the badge is 100pt wide; 120 gives it room. */
const APPLE_BADGE_WIDTH = 132;
const APPLE_BADGE_HEIGHT = Math.round((APPLE_BADGE_WIDTH * 76) / 240);

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
        src="/wallet/add-to-apple-wallet.svg"
        alt="Add to Apple Wallet"
        width={APPLE_BADGE_WIDTH}
        height={APPLE_BADGE_HEIGHT}
        // Apple's artwork must not be resized non-uniformly or recoloured, so
        // it gets explicit dimensions and no filters.
        priority={false}
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
