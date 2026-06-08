import Foundation

/// Error thrown by the App Intents runtime. Conforms to both `LocalizedError` and `CustomNSError`
/// so the `message` surfaces as the error's `localizedDescription` (Shortcuts/Siri display this
/// rather than a generic "error 1").
struct ExpoIntentsError: LocalizedError, CustomNSError {
  let message: String

  var errorDescription: String? { message }

  static var errorDomain: String { "ExpoIntentsError" }
  var errorCode: Int { 1 }
  var errorUserInfo: [String: Any] { [NSLocalizedDescriptionKey: message] }
}
