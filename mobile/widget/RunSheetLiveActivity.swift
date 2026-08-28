import ActivityKit
import SwiftUI
import WidgetKit

/**
 Tonight's run sheet, on the lock screen.

 What is on, how long until the next thing, and what that thing is. Read in a
 dark room, at arm's length, by somebody who has about two seconds for it — so
 one line of large type, one bar, and one line of small type, and nothing else.

 Nothing here is fed by a timer of ours. The bar is a `ProgressView` over a date
 range and the countdown is a `Text` over one, both of which the system draws
 and advances on a locked handset with the app long since suspended. The only
 thing a push has to deliver is the names, and names change when an item does.
 */
struct RunSheetLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: RunSheetAttributes.self) { context in
      LockScreen(attributes: context.attributes, state: context.state)
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        // True black, as everywhere else in Atmos. On an always-on display the
        // lit pixels are the type and the bar, and nothing else.
        .activityBackgroundTint(.black)
        .activitySystemActionForegroundColor(.white)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Eyebrow(text: context.attributes.gigTitle)
        }
        DynamicIslandExpandedRegion(.trailing) {
          Countdown(state: context.state)
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(alignment: .leading, spacing: 8) {
            Headline(text: context.state.headline)
            Bar(state: context.state)
            Footnote(state: context.state)
          }
        }
      } compactLeading: {
        Text(context.state.headline)
          .font(.system(size: 13, weight: .heavy))
          .lineLimit(1)
          .frame(maxWidth: 68, alignment: .leading)
      } compactTrailing: {
        Countdown(state: context.state)
      } minimal: {
        Countdown(state: context.state)
      }
      .keylineTint(.white)
    }
  }
}

/// The whole lock screen: three lines, one of which is a bar.
private struct LockScreen: View {
  let attributes: RunSheetAttributes
  let state: RunSheetAttributes.ContentState

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Eyebrow(text: attributes.gigTitle)
      Headline(text: state.headline)
      Bar(state: state)
      Footnote(state: state)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

/// Which night this is. Present so a phone in a pocket at two gigs is not a
/// guess, faint because it is the one thing here you already know.
private struct Eyebrow: View {
  let text: String

  var body: some View {
    Text(text.uppercased())
      .font(.system(size: 10, weight: .semibold))
      .tracking(0.9)
      .foregroundStyle(.white.opacity(0.38))
      .lineLimit(1)
  }
}

/// What is on, or what is about to be. The one thing worth reading at a glance.
private struct Headline: View {
  let text: String

  var body: some View {
    Text(text)
      .font(.system(size: 22, weight: .heavy))
      .foregroundStyle(.white)
      .lineLimit(1)
      .minimumScaleFactor(0.65)
  }
}

/**
 Two bars: how far through this item, and how far through the night.

 The bright one is the current item. Its span is the item's own end where one
 was typed, and the next item's start where one was not — which is what makes it
 run all the way through a changeover instead of stopping dead at the end of a
 set. It is absent while waiting, because a bar with nothing to measure is
 decoration.

 The faint one under it is the whole night, first item to last. Same shape, a
 third of the weight: the hierarchy is the whole label. One is what you are
 doing, the other is where you are up to, and neither needs a word to say so.
 */
private struct Bar: View {
  let state: RunSheetAttributes.ContentState

  var body: some View {
    VStack(spacing: 5) {
      if let span = state.span {
        Track(span: span, tint: .white)
      }
      if let span = state.showSpan {
        Track(span: span, tint: .white.opacity(0.3))
      }
    }
  }
}

/// One bar, filling across a span. Drawn and advanced by the system.
private struct Track: View {
  let span: ClosedRange<Date>
  let tint: Color

  var body: some View {
    ProgressView(timerInterval: span, countsDown: false) {
      EmptyView()
    } currentValueLabel: {
      EmptyView()
    }
    .progressViewStyle(.linear)
    .tint(tint)
  }
}

/// What is next, and how long there is. The line the whole thing exists for.
private struct Footnote: View {
  let state: RunSheetAttributes.ContentState

  var body: some View {
    HStack(alignment: .firstTextBaseline, spacing: 8) {
      Text(state.countdownLabel)
        .font(.system(size: 10, weight: .bold))
        .tracking(0.9)
        .foregroundStyle(.white.opacity(0.38))

      if let next = state.footnoteName {
        Text(next)
          .font(.system(size: 13, weight: .semibold))
          .foregroundStyle(.white.opacity(0.75))
          .lineLimit(1)
      } else if let at = state.nextStartsAt {
        // Waiting. The countdown says how long; this says what time.
        Text(at, style: .time)
          .font(.system(size: 13, weight: .semibold))
          .foregroundStyle(.white.opacity(0.75))
      }

      Spacer(minLength: 8)
      Countdown(state: state)
    }
  }
}

/// The time until the next item, ticking without anything of ours running.
private struct Countdown: View {
  let state: RunSheetAttributes.ContentState

  var body: some View {
    if let countdown = state.countdown {
      Text(timerInterval: countdown, countsDown: true)
        .font(.system(size: 15, weight: .bold).monospacedDigit())
        .foregroundStyle(.white)
        .multilineTextAlignment(.trailing)
        .frame(maxWidth: 72, alignment: .trailing)
    }
  }
}
