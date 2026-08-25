import { readFileSync } from "node:fs";

import type { ExpoConfig } from "expo/config";

/**
 * The version, from one place.
 *
 * Read out of package.json rather than written here as well, because two copies
 * of a version number are two copies that disagree the first time somebody bumps
 * only one of them. Read with `fs` rather than imported so the config does not
 * depend on `resolveJsonModule` being on wherever Expo loads it from.
 *
 * `APP_VERSION` overrides it for a one-off build without a commit.
 */
const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version: string };

/**
 * Atmos app config.
 *
 * `scheme` is what better-auth's OAuth callback and the ticket deep links come
 * back to, so it has to match the value added to `trustedOrigins` on the server
 * and the associated-domains entry below.
 */
const config: ExpoConfig = {
  name: "Atmos",
  slug: "atmos",
  version: process.env.APP_VERSION ?? pkg.version,
  orientation: "portrait",
  scheme: "atmos",
  userInterfaceStyle: "dark",
  icon: "./assets/icon.png",
  ios: {
    bundleIdentifier: "nz.co.atmosmedia.app",
    // App Store Connect rejects a build whose number it has already seen, so
    // this has to go up on every upload of the same version.
    buildNumber: process.env.BUILD_NUMBER ?? "1",
    // No iPad can do Tap to Pay, and the door screens are laid out for a phone
    // held one-handed in the dark.
    supportsTablet: false,
    // Lets the existing emailed ticket links
    // (https://atmosmedia.co.nz/tickets/...) open the app instead of Safari
    // when it is installed, and lets iOS offer a saved atmosmedia.co.nz
    // password on the sign-in screen instead of making somebody type it.
    //
    // Both only work if the site serves
    // `/.well-known/apple-app-site-association` — see the route handler of that
    // name in the website. Claiming a domain that 404s is silently inert.
    associatedDomains: [
      "applinks:atmosmedia.co.nz",
      "webcredentials:atmosmedia.co.nz",
    ],
    /**
     * Tap to Pay, and push. Both entitlements differ between a build installed
     * straight to a device and one going to the App Store, so both follow the
     * environment rather than being hardcoded. `scripts/build-ipa.sh` sets the
     * store values; the defaults here are the device ones.
     *
     * Apple granted Tap to Pay for **development only**. An App Store profile
     * is issued without the capability, and exporting an archive that claims it
     * fails outright — so a store build has to ship without it. The Stripe SDK
     * then reports Tap to Pay as unavailable, which the sell sheet already
     * handles as a first-class state.
     *
     * `aps-environment` is the mirror image: a development profile only carries
     * the development value, so hardcoding production breaks the device builds,
     * while a store build needs production or it registers tokens the server
     * can never push to.
     *
     * See `docs/ticketing/TAP-TO-PAY.md`.
     */
    entitlements: {
      ...(process.env.TAP_TO_PAY === "0"
        ? {}
        : { "com.apple.developer.proximity-reader.payment.acceptance": true }),
      "aps-environment": process.env.APS_ENVIRONMENT ?? "development",
    },
    /**
     * Note what is deliberately *absent* here: `UIRequiredDeviceCapabilities`
     * with `iphone-ipad-minimum-performance-a12`, and a raised deployment
     * target.
     *
     * Apple's App Review checklist rows 1.2 and 1.3 ask for both, but each is
     * conditional on Tap to Pay being the app's *primary* payment method. It is
     * not: this is a consumer ticketing app whose primary payment method is
     * Stripe checkout on the web, and Tap to Pay is internal box-office tooling
     * for Atmos door staff. Requiring an A12 would lock a punter with an
     * iPhone 8 out of their own ticket over a staff feature they cannot see.
     *
     * The device floor is enforced where it belongs instead — at runtime, in
     * `src/lib/tap-to-pay.tsx`, which reports an unsupported handset or an
     * out-of-date iOS as its own first-class state (checklist rows 1.1, 1.4).
     */
    infoPlist: {
      NSCameraUsageDescription:
        "Atmos uses the camera to scan tickets at the door.",
      // Checklist 1.7 — Face ID unlocks a handset that is already signed in, so
      // door staff are not typing a password at a door in the dark.
      NSFaceIDUsageDescription:
        "Atmos uses Face ID to unlock this handset for door mode and your tickets.",
      ITSAppUsesNonExemptEncryption: false,
      /**
       * Which commit this binary is.
       *
       * A build number says which build; it does not say what is in it. With
       * this, a TestFlight build that misbehaves can be traced back to a commit
       * without keeping a spreadsheet. Written by `scripts/build-ipa.sh`;
       * "dev" for anything built off a laptop by hand.
       */
      ATMOSGitCommit: process.env.GIT_COMMIT ?? "dev",
    },
  },
  android: {
    package: "nz.co.atmosmedia.app",
    adaptiveIcon: {
      foregroundImage: "./assets/android-icon-foreground.png",
      // Android 13+ tints this to the user's wallpaper palette, so it has to
      // be a flat silhouette rather than the full artwork.
      monochromeImage: "./assets/android-icon-monochrome.png",
      backgroundColor: "#000000",
    },
  },
  plugins: [
    "expo-router",
    /**
     * Sign in with Apple. Adds the `com.apple.developer.applesignin`
     * entitlement, which App Store Guideline 4.8 requires because the sign-in
     * screen also offers Google.
     *
     * The capability has to be switched on for this bundle identifier in the
     * Apple Developer portal and the provisioning profiles regenerated, or the
     * archive fails to sign against an entitlement the profile does not carry.
     *
     * `APPLE_SIGNIN=0` drops it, same shape as `TAP_TO_PAY=0`: a personal
     * device build signed against a cached profile that predates the
     * capability can still ship without it — the Apple button then fails with
     * the in-app error rather than the build failing to sign. Never set it
     * for a store build; `scripts/build-ipa.sh` fails if the entitlement is
     * absent there.
     */
    ...(process.env.APPLE_SIGNIN === "0" ? [] : ["expo-apple-authentication"]),
    [
      "expo-splash-screen",
      {
        image: "./assets/splash-icon.png",
        resizeMode: "contain",
        backgroundColor: "#000000",
      },
    ],
    "expo-secure-store",
    "expo-web-browser",
    [
      "expo-camera",
      {
        cameraPermission: "Atmos uses the camera to scan tickets at the door.",
      },
    ],
    [
      "expo-notifications",
      {
        // Android draws notification icons as a silhouette, which is exactly
        // what the monochrome adaptive icon already is.
        icon: "./assets/android-icon-monochrome.png",
        color: "#000000",
      },
    ],
    // Tap to Pay. The entitlement itself is requested through Stripe and
    // granted by Apple against the bundle identifier above.
    //
    // The reader is the phone, so none of the Bluetooth or local-network
    // permissions that physical Stripe readers need apply here. They are
    // declared off explicitly rather than left undefined — the plugin reads
    // every one of these and throws on a bare string entry.
    [
      "@stripe/stripe-terminal-react-native",
      {
        bluetoothBackgroundMode: false,
        tapToPayCheck: true,
        locationWhenInUsePermission:
          "Stripe uses your location to process payments at the door.",
        bluetoothPeripheralPermission: false,
        bluetoothAlwaysUsagePermission: false,
        localNetworkUsagePermission: false,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  // The EAS account that owns the project and signs the builds.
  owner: "dcralph",
  extra: {
    eas: {
      // Written by hand because `eas init` cannot edit a dynamic config. Not a
      // secret — it is a public project identifier, and the app needs it at
      // runtime to request a push token.
      projectId:
        process.env.EAS_PROJECT_ID ?? "6316ae40-5033-4312-8b72-e3e8daa58464",
    },
  },
  updates: {
    url: "https://u.expo.dev/6316ae40-5033-4312-8b72-e3e8daa58464",
  },
  runtimeVersion: { policy: "appVersion" },
};

export default config;
