import SwiftUI
import WidgetKit

/**
 The widget extension's entry point.

 One widget in it, and no home screen widget: everything Atmos has to say to
 somebody working a night is time-critical and belongs on the lock screen while
 the night is on, rather than on a home screen the rest of the month.
 */
@main
struct RunSheetWidgetBundle: WidgetBundle {
  var body: some Widget {
    RunSheetLiveActivity()
  }
}
