const { withIosExtension } = require("./ios-extension");
/** Both ActivityKit types must be compiled into the app and this widget. */
module.exports = (config) =>
  withIosExtension(config, {
    name: "RunSheetWidget",
    sources: [
      ["widget", "RunSheetWidgetBundle.swift"],
      ["widget", "RunSheetLiveActivity.swift"],
      ["widget", "TaskDayLiveActivity.swift"],
      ["modules/run-sheet-activity/ios", "RunSheetActivityAttributes.swift"],
      ["modules/run-sheet-activity/ios", "TaskDayAttributes.swift"],
    ],
    info: ["widget", "RunSheetWidget-Info.plist"],
  });
