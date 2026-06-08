import Foundation

/// Shared store backed by an App Group `UserDefaults`, so both the main app (which registers
/// handlers and writes shared data) and the App Intents runtime (which executes handlers
/// outside the React Native process) read the same data.
///
/// Two namespaces live here:
///   - handler sources: serialised `fn.toString()` keyed by intent name,
///   - shared data: arbitrary JSON strings keyed by a user-provided key.
final class IntentsStorage {
  static let shared = IntentsStorage()

  private static let handlerPrefix = "expo.intents.handler."
  private static let dataPrefix = "expo.intents.data."

  private init() {}

  /// The App Group identifier is written by the config plugin into the main app's Info.plist
  /// under `ExpoIntentsAppGroup`. Falls back to `UserDefaults.standard` when absent (e.g. when
  /// no App Group was configured), which still works for same-process access.
  private var defaults: UserDefaults {
    if let group = Bundle.main.object(forInfoDictionaryKey: "ExpoIntentsAppGroup") as? String,
       let shared = UserDefaults(suiteName: group) {
      return shared
    }
    return .standard
  }

  // MARK: - Handler sources

  func setHandlerSource(_ source: String, for name: String) {
    defaults.set(source, forKey: Self.handlerPrefix + name)
  }

  func handlerSource(for name: String) -> String? {
    defaults.string(forKey: Self.handlerPrefix + name)
  }

  // MARK: - Shared data

  /// Stores a JSON string under `key`. The value is produced by `JSON.stringify` on the JS side.
  func setSharedData(_ json: String, for key: String) {
    defaults.set(json, forKey: Self.dataPrefix + key)
  }

  /// Returns the JSON string stored under `key`, or nil if absent.
  func sharedData(for key: String) -> String? {
    defaults.string(forKey: Self.dataPrefix + key)
  }

  func removeSharedData(for key: String) {
    defaults.removeObject(forKey: Self.dataPrefix + key)
  }
}
