import Foundation

#if canImport(ActivityKit)
  import ActivityKit

  /**
   The run sheet, as a Live Activity.

   This file is compiled into two targets — the Expo module here, and the widget
   extension — because ActivityKit matches an activity to the widget that draws
   it by the name of this type. It is copied into `ios/RunSheetWidget/` by
   `plugins/with-run-sheet-widget.js` at prebuild rather than kept in two places,
   so the pair cannot drift.

   Everything the lock screen shows is a name or a pair of dates. That is the
   whole design: SwiftUI renders a countdown and a progress bar from dates
   without anything running, so a locked handset stays right minute to minute on
   its own, and a push is only needed when an item actually changes.
   */
  @available(iOS 16.2, *)
  public struct RunSheetAttributes: ActivityAttributes {
    /// The parts that change during the night.
    public struct ContentState: Codable, Hashable {
      /// What is on now. Absent before the first item, and in a gap.
      public var currentName: String?
      /// The span the progress bar is drawn across.
      public var currentStartsAt: Date?
      public var currentEndsAt: Date?
      /// What is on next, and when. Absent once the last item is running.
      public var nextName: String?
      public var nextStartsAt: Date?
      /// The night end to end. Fixed for the life of the activity.
      public var showStartsAt: Date?
      public var showEndsAt: Date?

      public init(
        currentName: String? = nil,
        currentStartsAt: Date? = nil,
        currentEndsAt: Date? = nil,
        nextName: String? = nil,
        nextStartsAt: Date? = nil,
        showStartsAt: Date? = nil,
        showEndsAt: Date? = nil
      ) {
        self.currentName = currentName
        self.currentStartsAt = currentStartsAt
        self.currentEndsAt = currentEndsAt
        self.nextName = nextName
        self.nextStartsAt = nextStartsAt
        self.showStartsAt = showStartsAt
        self.showEndsAt = showEndsAt
      }
    }

    /// Fixed for the life of the activity: which night this is.
    public var gigId: String
    public var gigTitle: String

    public init(gigId: String, gigTitle: String) {
      self.gigId = gigId
      self.gigTitle = gigTitle
    }
  }

  @available(iOS 16.2, *)
  extension RunSheetAttributes.ContentState {
    /// The line in large type: what is on, or what is about to be.
    public var headline: String {
      currentName ?? nextName ?? "—"
    }

    /// Whether an item is actually running, as opposed to being waited for.
    public var isRunning: Bool { currentName != nil }

    /**
     What the progress bar spans, or nothing when there is nothing to fill.

     Guarded rather than trusted: `ProgressView(timerInterval:)` traps on a
     range that does not go forwards, and a run sheet is typed by a human at
     11pm.
     */
    public var span: ClosedRange<Date>? {
      guard let from = currentStartsAt, let to = currentEndsAt, from < to else {
        return nil
      }
      return from...to
    }

    /**
     What the countdown counts to: the next item, or the end of this one when
     it is the last thing on.
     */
    public var countdownTarget: Date? {
      nextStartsAt ?? currentEndsAt
    }

    /// A range `Text(timerInterval:)` will accept even once the target is past.
    public var countdown: ClosedRange<Date>? {
      guard let target = countdownTarget else { return nil }
      let now = Date()
      return now <= target ? now...target : target...target.addingTimeInterval(1)
    }

    /**
     What the second bar spans: the night, first item to last.

     Nothing until the night has actually started, because a bar that cannot
     have moved yet is a bar that says nothing. It appears when the first item
     does, which is one of the moments the sweep already pushes on.
     */
    public var showSpan: ClosedRange<Date>? {
      guard let from = showStartsAt, let to = showEndsAt, from < to, from <= Date()
      else {
        return nil
      }
      return from...to
    }

    /**
     What goes beside the countdown, when it is a name.

     Nothing while waiting: the thing being waited for is already the headline,
     and there is one small line here to spend. The widget shows the clock time
     instead, which is the part a countdown does not tell you.
     */
    public var footnoteName: String? {
      isRunning ? nextName : nil
    }

    /// The small word in front of the countdown.
    public var countdownLabel: String {
      if !isRunning { return "STARTS" }
      return nextName != nil ? "NEXT" : "ENDS"
    }
  }
#endif
