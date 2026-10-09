import Foundation
#if canImport(ActivityKit)
import ActivityKit
@available(iOS 16.2, *)
public struct TaskDayAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    public var display: RunSheetAttributes.ContentState
    public var taskId: String
    public var remaining: Int
    public var overdue: Bool
  }
  public var userId: String
  public var day: String
}
#endif
