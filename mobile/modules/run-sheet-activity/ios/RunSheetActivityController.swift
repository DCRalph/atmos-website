import Foundation

#if canImport(ActivityKit)
  import ActivityKit
#endif

/**
 What the run sheet sends, whether it came from the app or from the server.

 The field names and the epoch-second times are `ActivityPayload` in
 `src/lib/run-sheet/live-activity.ts`. One shape, encoded once on the server and
 once by the app, decoded once here — so a lock screen moved on by a silent push
 in the middle of the night and one moved on by the app in somebody's hand
 cannot end up saying different things.
 */
struct RunSheetActivityPayload: Decodable {
  let gigId: String
  let gigTitle: String
  /// False takes the activity down: the night is over, or too far off yet.
  let active: Bool
  let currentName: String?
  let currentStartsAt: Double?
  let currentEndsAt: Double?
  let nextName: String?
  let nextStartsAt: Double?
  let showStartsAt: Double?
  let showEndsAt: Double?
}

private func date(_ seconds: Double?) -> Date? {
  guard let seconds else { return nil }
  return Date(timeIntervalSince1970: seconds)
}

#if canImport(ActivityKit)
  @available(iOS 16.2, *)
  extension RunSheetActivityPayload {
    var contentState: RunSheetAttributes.ContentState {
      RunSheetAttributes.ContentState(
        currentName: currentName,
        currentStartsAt: date(currentStartsAt),
        currentEndsAt: date(currentEndsAt),
        nextName: nextName,
        nextStartsAt: date(nextStartsAt),
        showStartsAt: date(showStartsAt),
        showEndsAt: date(showEndsAt)
      )
    }

    /**
     When what this says stops being true.

     iOS dims a stale activity rather than leaving it looking authoritative,
     which is the honest thing to do about a silent push that never arrived —
     the times on screen are still ticking correctly, but the names are not to
     be trusted past here.
     */
    var staleDate: Date? {
      date(nextStartsAt) ?? date(currentEndsAt)
    }
  }
#endif

/**
 Starting, moving and ending the one Live Activity this app has.

 Deliberately not a class with state. The system already holds the list of
 running activities, and a second copy of "which one is up" in here is a second
 copy to be wrong — particularly across a background wake-up, where nothing of
 the app's own is guaranteed to have survived.

 One night at a time: an activity for a different gig is taken down rather than
 left beside the new one. Two run sheets on a lock screen is two things to read
 in a dark room when there is only ever one you are working.
 */
enum RunSheetActivityController {
  /// Whether this handset can show one at all, and has not been told not to.
  static var isSupported: Bool {
    #if canImport(ActivityKit)
      if #available(iOS 16.2, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
    #endif
    return false
  }

  /// Apply a payload as it arrives on the wire. Bad JSON is ignored, not thrown.
  @discardableResult
  static func apply(json: String) -> Bool {
    guard
      let data = json.data(using: .utf8),
      let payload = try? JSONDecoder().decode(RunSheetActivityPayload.self, from: data)
    else {
      return false
    }
    return apply(payload)
  }

  @discardableResult
  static func apply(_ payload: RunSheetActivityPayload) -> Bool {
    #if canImport(ActivityKit)
      guard #available(iOS 16.2, *) else { return false }

      let running = Activity<RunSheetAttributes>.activities

      guard payload.active else {
        end(running)
        return true
      }

      let content = ActivityContent(
        state: payload.contentState,
        staleDate: payload.staleDate
      )

      end(running.filter { $0.attributes.gigId != payload.gigId })

      if let existing = running.first(where: { $0.attributes.gigId == payload.gigId }) {
        Task { await existing.update(content) }
        return true
      }

      // Starting one needs the app to be in front — iOS refuses a request from
      // the background, which is why a push can move an activity on and end it
      // but cannot conjure one. The app puts it up when it is next opened.
      guard ActivityAuthorizationInfo().areActivitiesEnabled else { return false }

      do {
        _ = try Activity.request(
          attributes: RunSheetAttributes(
            gigId: payload.gigId,
            gigTitle: payload.gigTitle
          ),
          content: content,
          pushType: nil
        )
        return true
      } catch {
        return false
      }
    #else
      return false
    #endif
  }

  /// Take everything down, for a sign-out.
  static func endAll() {
    #if canImport(ActivityKit)
      guard #available(iOS 16.2, *) else { return }
      end(Activity<RunSheetAttributes>.activities)
    #endif
  }

  #if canImport(ActivityKit)
    @available(iOS 16.2, *)
    private static func end(_ activities: [Activity<RunSheetAttributes>]) {
      for activity in activities {
        Task { await activity.end(nil, dismissalPolicy: .immediate) }
      }
    }
  #endif
}
