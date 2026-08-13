import { requireOptionalNativeModule } from "expo-modules-core";

/**
 * Apple's own Tap to Pay on iPhone merchant education.
 *
 * App Review checklist 4.1 requires `ProximityReaderDiscovery` on iOS 18 and
 * later, and the checklist's own note says that using it fulfils 4.4, 4.6, 4.7
 * and 4.8 as well. Apple writes, localises and maintains that content for the
 * merchant's region, which is precisely why they would rather we presented
 * theirs than drew our own.
 *
 * The native side lives in `modules/proximity-education` — a local Expo module
 * rather than a patch to `ios/`, which `expo prebuild` regenerates and git
 * ignores. Nothing is imported from that folder here: autolinking registers the
 * module under its `Name("ProximityEducation")`, and looking it up by name is
 * what keeps this file free of a path into the native tree.
 *
 * The Stripe Terminal React Native SDK does not expose any of this; its iOS
 * bridge touches `TapToPayDiscoveryConfiguration` only. No dependency is added
 * by going direct — `ProximityReader` is a system framework already linked by
 * the Terminal SDK.
 */
type ProximityEducationModule = {
  isAvailable: () => boolean;
  presentHowToTap: () => Promise<void>;
};

const native =
  requireOptionalNativeModule<ProximityEducationModule>("ProximityEducation");

/**
 * Can Apple present its own education on this handset?
 *
 * False on iOS 17 and earlier, and off iOS entirely. That is not a failure —
 * it is the signal to show the app's own screens, which are the *required*
 * fallback for those versions rather than a nicety.
 */
export function isAppleEducationAvailable(): boolean {
  try {
    return native?.isAvailable() ?? false;
  } catch {
    return false;
  }
}

/**
 * Present Apple's "How to Tap" content.
 *
 * Resolves false when it could not be shown, rather than throwing: at a door,
 * an unavailable API and a failed presentation call for the same response —
 * show our own education instead — so callers should not have to tell them
 * apart.
 */
export async function presentAppleHowToTap(): Promise<boolean> {
  if (!native) return false;
  try {
    await native.presentHowToTap();
    return true;
  } catch {
    return false;
  }
}
