import ExpoModulesCore

/**
 The run sheet's Live Activity, from JavaScript.

 A thin door onto `RunSheetActivityController`, and thin on purpose: the same
 controller is driven from a silent push in `RunSheetActivitySubscriber`, where
 there is no JavaScript running at all. Anything that lived here rather than
 there would be logic a backgrounded handset never gets to run.

 The argument is a JSON string rather than a record for the same reason. It is
 byte for byte what the server puts in the push, so the app and the sweep take
 the identical path into the identical decoder.
 */
public class RunSheetActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("RunSheetActivity")

    /**
     Whether a lock screen here can show one.

     False on iOS 16.1 and earlier, and false when somebody has turned Live
     Activities off for Atmos in Settings. The caller treats both the same way:
     the run sheet screen is the feature, and this is a courtesy on top of it.
     */
    Function("isSupported") { () -> Bool in
      RunSheetActivityController.isSupported
    }

    /**
     Put the activity up, move it on, or take it down — whichever the payload
     says. Returns false when nothing could be done, which on a supported
     handset means iOS refused to start one.
     */
    AsyncFunction("apply") { (payload: String) -> Bool in
      RunSheetActivityController.apply(json: payload)
    }
      .runOnQueue(.main)

    /** Forget the night. Called on sign-out, when the run sheet stops being ours. */
    AsyncFunction("endAll") {
      RunSheetActivityController.endAll()
    }
      .runOnQueue(.main)
  }
}
