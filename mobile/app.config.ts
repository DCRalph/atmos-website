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
    supportsTablet: false,
    // Lets the existing emailed ticket links
    // (https://atmosmedia.co.nz/tickets/...) open the app instead of Safari
    // when it is installed.
    associatedDomains: ["applinks:atmosmedia.co.nz"],
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
