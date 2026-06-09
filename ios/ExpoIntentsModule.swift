import ExpoModulesCore

public class ExpoIntentsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoIntents")

    // Persists a serialised handler (`fn.toString()`) so the App Intents runtime can run it
    // later, outside the React Native process. Keyed by the intent's handler name, which must
    // match the `name` declared for the intent in the config plugin.
    Function("registerHandler") { (name: String, source: String) in
      IntentsStorage.shared.setHandlerSource(source, for: name)
    }

    // Shared data is stored as JSON strings (the JS side handles serialisation) so the App
    // Intents runtime can read app state that was captured while the app was running.
    Function("setSharedData") { (key: String, json: String) in
      IntentsStorage.shared.setSharedData(json, for: key)
    }

    Function("getSharedData") { (key: String) -> String? in
      IntentsStorage.shared.sharedData(for: key)
    }

    Function("removeSharedData") { (key: String) in
      IntentsStorage.shared.removeSharedData(for: key)
    }

    // Persists a serialised entity-query function so the App Intents runtime can fetch/search the
    // app's entities later. `method` is one of "suggested", "find", "get".
    Function("registerEntityHandler") { (type: String, method: String, source: String) in
      IntentsStorage.shared.setEntityQuerySource(source, type: type, method: method)
    }
  }
}
