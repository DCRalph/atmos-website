import type { ExpoConfig } from "expo/config";

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
  version: "1.0.0",
  orientation: "portrait",
  scheme: "atmos",
  userInterfaceStyle: "dark",
  icon: "./assets/icon.png",
  ios: {
    bundleIdentifier: "nz.co.atmosmedia.app",
    // App Store Connect rejects a build whose number it has already seen, so
    // this has to go up on every upload of the same version.
    buildNumber: process.env.BUILD_NUMBER ?? "1",
    supportsTablet: false,
    // Lets the existing emailed ticket links
    // (https://atmosmedia.co.nz/tickets/...) open the app instead of Safari
    // when it is installed.
    associatedDomains: ["applinks:atmosmedia.co.nz"],
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
    infoPlist: {
      NSCameraUsageDescription:
        "Atmos uses the camera to scan tickets at the door.",
      ITSAppUsesNonExemptEncryption: false,
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
