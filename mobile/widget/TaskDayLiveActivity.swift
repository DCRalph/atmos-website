import ActivityKit
import SwiftUI
import WidgetKit
struct TaskDayLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: TaskDayAttributes.self) { context in
      VStack(alignment: .leading, spacing: 8) {
        Eyebrow(text: "Tasks today")
        Headline(text: context.state.display.headline)
        if let span = context.state.display.span { Track(span: span, tint: .white) }
        TaskCountdown(due: context.state.display.currentEndsAt, overdue: context.state.overdue)
        if let next = context.state.display.nextName {
          HStack { Text("Then: \(next)").lineLimit(1); if let at = context.state.display.nextStartsAt { Text(at, style: .time) } }
            .font(.system(size: 12)).foregroundStyle(.white.opacity(0.65))
        }
        if context.state.remaining > 0 { Text("+\(context.state.remaining) more").font(.system(size: 11)).foregroundStyle(.white.opacity(0.65)) }
      }
      .padding(16).activityBackgroundTint(.black).activitySystemActionForegroundColor(.white)
      .widgetURL(URL(string: "atmos://tasks/\(context.state.taskId)"))
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) { Eyebrow(text: "Tasks today") }
        DynamicIslandExpandedRegion(.trailing) { TaskCountdown(due: context.state.display.currentEndsAt, overdue: context.state.overdue) }
        DynamicIslandExpandedRegion(.bottom) { Headline(text: context.state.display.headline) }
      } compactLeading: {
        Text(context.state.display.headline).font(.system(size: 12, weight: .bold)).lineLimit(1).frame(maxWidth: 70)
      } compactTrailing: { TaskCountdown(due: context.state.display.currentEndsAt, overdue: context.state.overdue) }
        minimal: { TaskCountdown(due: context.state.display.currentEndsAt, overdue: context.state.overdue) }
      .widgetURL(URL(string: "atmos://tasks/\(context.state.taskId)"))
    }
  }
}
private struct TaskCountdown: View {
  let due: Date?
  let overdue: Bool
  var body: some View {
    if let due {
      // The OS updates the signed offset across zero, even without a new activity push.
      HStack(spacing: 6) {
        Text(overdue ? "OVERDUE" : "DUE").font(.system(size: 10, weight: .bold))
        Text(due, style: .offset).font(.system(size: 14, weight: .bold).monospacedDigit())
      }.foregroundStyle(.white)
    }
  }
}
