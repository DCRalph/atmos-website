import Foundation
#if canImport(ActivityKit)
import ActivityKit
import UIKit
#endif
struct TaskDayPayload: Decodable {
  let userId: String
  let day: String
  let active: Bool
  let taskId: String?
  let currentName: String?
  let currentStartsAt: Double?
  let currentEndsAt: Double?
  let nextName: String?
  let nextStartsAt: Double?
  let remaining: Int
  let expiresAt: Double
}
enum TaskDayActivityController {
  @discardableResult
  static func apply(json: String) -> Bool {
    #if canImport(ActivityKit)
    guard #available(iOS 16.2, *), let data = json.data(using: .utf8),
      let payload = try? JSONDecoder().decode(TaskDayPayload.self, from: data) else { return false }
    // A payload from a previous session cannot bring another admin's task back.
    guard UserDefaults.standard.string(forKey: "taskActivityUserId") == payload.userId else { return false }
    guard payload.active, let id = payload.taskId,
      payload.expiresAt > Date().timeIntervalSince1970,
      Activity<RunSheetAttributes>.activities.isEmpty else { endAll(); return false }
    func date(_ value: Double?) -> Date? { value.map { Date(timeIntervalSince1970: $0) } }
    let state = TaskDayAttributes.ContentState(
      display: RunSheetAttributes.ContentState(currentName: payload.currentName,
        currentStartsAt: date(payload.currentStartsAt), currentEndsAt: date(payload.currentEndsAt),
        nextName: payload.nextName, nextStartsAt: date(payload.nextStartsAt)),
      taskId: id, remaining: payload.remaining,
      overdue: (payload.currentEndsAt ?? .greatestFiniteMagnitude) < Date().timeIntervalSince1970)
    let content = ActivityContent(state: state, staleDate: date(payload.expiresAt))
    for activity in Activity<TaskDayAttributes>.activities {
      if activity.attributes.userId == payload.userId && activity.attributes.day == payload.day {
        Task { await activity.update(content) }; return true
      }
      Task { await activity.end(nil, dismissalPolicy: .immediate) }
    }
    guard UIApplication.shared.applicationState == .active,
      ActivityAuthorizationInfo().areActivitiesEnabled else { return false }
    do { _ = try Activity.request(attributes: TaskDayAttributes(userId: payload.userId, day: payload.day), content: content, pushType: nil); return true }
    catch { return false }
    #else
    return false
    #endif
  }
  static func setUser(_ userId: String?) {
    if UserDefaults.standard.string(forKey: "taskActivityUserId") != userId { endAll() }
    UserDefaults.standard.set(userId, forKey: "taskActivityUserId")
  }
  static func endAll() {
    #if canImport(ActivityKit)
    guard #available(iOS 16.2, *) else { return }
    for activity in Activity<TaskDayAttributes>.activities { Task { await activity.end(nil, dismissalPolicy: .immediate) } }
    #endif
  }
}
