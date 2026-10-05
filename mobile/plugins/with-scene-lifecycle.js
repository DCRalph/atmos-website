const { withAppDelegate, withInfoPlist } = require("@expo/config-plugins");

/**
 * The UIScene life cycle, which iOS 27 requires.
 *
 * An app built against the iOS 27 SDK that still starts from its app delegate
 * is killed at launch on iOS 27, before drawing a frame: SIGTRAP in
 * `_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`. Expo SDK
 * 57's prebuild template still writes that app delegate. `expo` 57.0.26 ships
 * the scene delegate, but only SDK 58's template uses it, so this writes the
 * same shape into the generated project:
 *
 *  - the app delegate builds the React Native factory and nothing else, and
 *    conforms to `ExpoReactNativeFactoryProvider` so the scene can find it;
 *  - `SceneDelegate`, Expo's own, creates the window and starts React Native
 *    into it. Subclassed in the app target so it is certain to be linked;
 *  - Info.plist names that scene.
 *
 * Deep links and universal links reach React Native through Expo's scene event
 * forwarder, so the app delegate's Linking overrides go too, as they do in
 * SDK 58's template.
 *
 * Delete this once the app is on SDK 58, whose template does all of it.
 */
module.exports = function withSceneLifecycle(config) {
  config = withInfoPlist(config, (config) => {
    config.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: "Default Configuration",
            UISceneDelegateClassName: "$(PRODUCT_MODULE_NAME).SceneDelegate",
          },
        ],
      },
    };
    return config;
  });

  return withAppDelegate(config, (config) => {
    config.modResults.contents = adoptScenes(config.modResults.contents);
    return config;
  });
};

const CLASS = "class AppDelegate: ExpoAppDelegate {";

const START_IN_WINDOW = `
#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif
`;

/** The Linking API and Universal Links overrides, up to the class's closing brace. */
const LINKING_OVERRIDES =
  /\n {2}\/\/ Linking API\n[\s\S]*?\n {2}\/\/ Universal Links\n[\s\S]*?\n {2}\}\n(?=\}\n)/;

/**
 * Rewrites the template's app delegate. Throws rather than skipping when the
 * template has changed underneath it: an app delegate this did not rewrite is
 * an app that dies on launch, and that should fail the build, not the phone.
 */
function adoptScenes(contents) {
  if (contents.includes("ExpoReactNativeFactoryProvider")) return contents;

  if (
    !contents.includes(CLASS) ||
    !contents.includes(START_IN_WINDOW) ||
    !LINKING_OVERRIDES.test(contents)
  ) {
    throw new Error(
      "with-scene-lifecycle: AppDelegate.swift is not the shape this plugin " +
        "rewrites. Compare it with SDK 58's template and update the plugin.",
    );
  }

  return (
    contents
      .replace(
        CLASS,
        "class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {",
      )
      .replace(
        START_IN_WINDOW,
        "\n    // The window is created and React Native started by `SceneDelegate`.\n",
      )
      .replace(LINKING_OVERRIDES, "") +
    `
/// Creates the window and starts React Native under the scene life cycle.
/// See \`plugins/with-scene-lifecycle.js\`.
@objc(SceneDelegate)
class SceneDelegate: ExpoAppSceneDelegate {}
`
  );
}
