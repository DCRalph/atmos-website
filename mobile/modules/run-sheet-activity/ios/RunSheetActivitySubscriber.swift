import ExpoModulesCore

/**
 The silent push that moves the lock screen on.

 The run sheet sweep sends one of these on the minute an item changes, carrying
 the whole new state. Nothing is fetched here: the push *is* the answer, worked
 out on the server by the same function the app would have used. That matters
 because this runs with the app in the background and a few seconds of budget —
 long enough to decode a small JSON object and hand it to ActivityKit, not long
 enough to start JavaScript, restore a session and make a network call.

 Registered in `expo-module.config.json`. Expo fans a remote notification out to
 every subscriber, so `expo-notifications` still sees this one; it carries no
 alert content, so nothing is shown.
 */
public class RunSheetActivitySubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didReceiveRemoteNotification userInfo: [AnyHashable: Any],
    fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    // Expo's push service puts the message's `data` at the top level under
    // `body`. Anything else is somebody else's notification.
    guard
      let body = userInfo["body"] as? [String: Any],
      let payload = body["runSheetActivity"] as? String
    else {
      completionHandler(.noData)
      return
    }

    let applied = RunSheetActivityController.apply(json: payload)
    completionHandler(applied ? .newData : .noData)
  }
}
