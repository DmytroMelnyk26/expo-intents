import Foundation

/// Bridges a raw entity dictionary (returned by a JS entity-query function) into the pieces the
/// generated `AppEntity` needs: a stable `id`, display `title`/`subtitle`, and the full object as
/// JSON to hand back to the intent handler when the entity is selected as a parameter.
public struct ExpoEntityData {
  public let id: String
  public let title: String
  public let subtitle: String?
  public let json: String

  public init?(_ dict: [String: Any]) {
    guard let id = ExpoEntityData.string(dict["id"]) else {
      return nil
    }
    self.id = id
    self.title = ExpoEntityData.string(dict["title"]) ?? id
    self.subtitle = ExpoEntityData.string(dict["subtitle"])
    if let data = try? JSONSerialization.data(withJSONObject: dict, options: []),
       let string = String(data: data, encoding: .utf8) {
      self.json = string
    } else {
      self.json = "{}"
    }
  }

  /// Parses an entity's stored JSON back into a value for the handler's `params` dictionary.
  public static func parse(_ json: String) -> Any {
    guard let data = json.data(using: .utf8),
          let object = try? JSONSerialization.jsonObject(with: data) else {
      return NSNull()
    }
    return object
  }

  private static func string(_ value: Any?) -> String? {
    if let string = value as? String {
      return string
    }
    if let number = value as? NSNumber {
      return number.stringValue
    }
    return nil
  }
}
