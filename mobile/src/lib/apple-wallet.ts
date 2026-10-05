import { requireOptionalNativeModule } from "expo-modules-core";

/**
 * Whether this device can add a pass to Apple Wallet.
 *
 * False on iPad, which has no Wallet app — and an iPhone-only app still runs
 * there, which is where App Review tests it. The native side is
 * `modules/apple-wallet`, looked up by name like `apple-education.ts` does.
 *
 * True when the module is missing, so a binary built before it existed keeps
 * offering the button it always did.
 */
export function canAddPasses(): boolean {
  try {
    return (
      requireOptionalNativeModule<{ canAddPasses: () => boolean }>(
        "AppleWallet",
      )?.canAddPasses() ?? true
    );
  } catch {
    return true;
  }
}
