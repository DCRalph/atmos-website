import ExpoModulesCore
import PassKit

/**
 Whether this device can hold an Apple Wallet pass.

 iPad has no Wallet app, and an iPhone-only app still runs there in
 compatibility mode — which is where App Review tests it. Opening a pass there
 lands on a blank sheet, so the ticket screen asks this first and does not
 offer the button where it cannot work.

 Asked of PassKit rather than worked out from the device model, because an
 iPhone app on an iPad reports the phone idiom, and the simulator reports the
 Mac's architecture as its model.
 */
public class AppleWalletModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AppleWallet")

    Function("canAddPasses") { () -> Bool in
      PKAddPassesViewController.canAddPasses()
    }
  }
}
