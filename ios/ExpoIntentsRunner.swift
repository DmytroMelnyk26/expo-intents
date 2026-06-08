import Foundation
import JavaScriptCore

/// Executes App Intent handlers inside a bare `JSContext`.
///
/// App Intents run in a process without a live React Native runtime, so we evaluate the
/// standalone `ExpoIntents.bundle` (built by Metro — see `scripts/build-bundle.mjs`) once,
/// then for each intent invocation we:
///   1. read the user's serialised handler source from the App Group store,
///   2. evaluate it and assign it to `globalThis.__expoIntentHandler`,
///   3. call `globalThis.__expoIntentPerform(params, context)` and await the returned Promise.
///
/// The generated Swift `AppIntent` structs (produced by the config plugin) call
/// `ExpoIntentsRunner.shared.perform(handler:params:)` from their `perform()` method.
public final class ExpoIntentsRunner {
  public static let shared = ExpoIntentsRunner()

  private let queue = DispatchQueue(label: "expo.intents.runner")
  private var context: JSContext?
  private var bundleScript: String?
  private var handlerCache: [String: JSValue] = [:]

  private init() {}

  /// Runs the handler registered under `name` with `params` and returns its result as a string
  /// (objects are JSON-serialised). Throws if the handler is missing or the JS rejects/throws.
  public func perform(handler name: String, params: [String: Any]) async throws -> String {
    guard let source = IntentsStorage.shared.handlerSource(for: name) else {
      throw ExpoIntentsError(message: "No registered handler for intent '\(name)'.")
    }

    return try await withCheckedThrowingContinuation { continuation in
      queue.async {
        self.invoke(name: name, source: source, params: params, continuation: continuation)
      }
    }
  }

  // MARK: - JS invocation

  private func invoke(
    name: String,
    source: String,
    params: [String: Any],
    continuation: CheckedContinuation<String, Error>
  ) {
    guard let context = getContext() else {
      continuation.resume(throwing: ExpoIntentsError(message: "Could not create a JSContext."))
      return
    }
    guard let handler = getHandlerValue(name: name, source: source, in: context) else {
      let message = exceptionMessage(context) ?? "Could not evaluate handler for '\(name)'."
      continuation.resume(throwing: ExpoIntentsError(message: message))
      return
    }

    context.exception = nil
    context.setObject(handler, forKeyedSubscript: "__expoIntentHandler" as NSString)

    guard let perform = context.objectForKeyedSubscript("__expoIntentPerform"),
          perform.isObject else {
      continuation.resume(
        throwing: ExpoIntentsError(message: "ExpoIntents runtime is not initialised (__expoIntentPerform missing).")
      )
      return
    }

    var didResume = false
    let resolve: @convention(block) (JSValue?) -> Void = { [weak self] value in
      guard !didResume else { return }
      didResume = true
      continuation.resume(returning: self?.stringify(value, in: context) ?? "")
    }
    let reject: @convention(block) (JSValue?) -> Void = { error in
      guard !didResume else { return }
      didResume = true
      let message = error?.toString() ?? "Intent handler rejected."
      continuation.resume(throwing: ExpoIntentsError(message: message))
    }

    let handlerContext: [String: Any] = ["intentName": name]
    let promise = perform.call(withArguments: [params, handlerContext])
    if let message = exceptionMessage(context) {
      if !didResume {
        didResume = true
        continuation.resume(throwing: ExpoIntentsError(message: message))
      }
      return
    }

    promise?.invokeMethod("then", withArguments: [resolve as Any, reject as Any])
    if let message = exceptionMessage(context), !didResume {
      didResume = true
      continuation.resume(throwing: ExpoIntentsError(message: message))
    }
  }

  // MARK: - Context lifecycle

  private func getContext() -> JSContext? {
    if let context {
      return context
    }
    guard let context = JSContext() else {
      return nil
    }
    guard let script = getBundleScript() else {
      print("[ExpoIntents] Missing ExpoIntents.bundle")
      return nil
    }

    // Native primitives must exist before the bundle evaluates, because `installPolyfills`
    // reads them at module-eval time to build `console`, `fetch`, and `getSharedData`.
    installNativePrimitives(into: context)

    context.evaluateScript(script)
    if let message = exceptionMessage(context) {
      print("[ExpoIntents] Bundle evaluation failed: \(message)")
      return nil
    }

    self.context = context
    return context
  }

  // MARK: - Native primitives

  /// Injects the host APIs that handlers rely on. `bundle/polyfills.ts` wraps these into the
  /// familiar `console`, `fetch`, and `getSharedData` globals.
  private func installNativePrimitives(into context: JSContext) {
    let log: @convention(block) (String, String) -> Void = { level, message in
      print("[ExpoIntents][\(level)] \(message)")
    }
    context.setObject(log, forKeyedSubscript: "__expoIntentsLog" as NSString)

    let getSharedData: @convention(block) (String) -> String? = { key in
      IntentsStorage.shared.sharedData(for: key)
    }
    context.setObject(getSharedData, forKeyedSubscript: "__expoIntentsGetSharedData" as NSString)

    let nativeFetch: @convention(block) (String, String) -> JSValue? = { [weak self] urlString, optionsJson in
      self?.makeFetchPromise(urlString: urlString, optionsJson: optionsJson, in: context)
    }
    context.setObject(nativeFetch, forKeyedSubscript: "__expoIntentsNativeFetch" as NSString)
  }

  /// Builds a JS `Promise` that wraps a `URLSession` request. The request runs off-context, and
  /// its completion is marshalled back onto `queue` before touching any `JSValue` (JSC is not
  /// thread-safe). Resolving/rejecting on `queue` lets JSC drain the handler's microtasks.
  private func makeFetchPromise(urlString: String, optionsJson: String, in context: JSContext) -> JSValue? {
    guard let promiseCtor = context.objectForKeyedSubscript("Promise") else {
      return nil
    }
    let executor: @convention(block) (JSValue, JSValue) -> Void = { [weak self] resolve, reject in
      self?.startRequest(urlString: urlString, optionsJson: optionsJson, resolve: resolve, reject: reject)
    }
    return promiseCtor.construct(withArguments: [executor])
  }

  private func startRequest(urlString: String, optionsJson: String, resolve: JSValue, reject: JSValue) {
    guard let url = URL(string: urlString) else {
      reject.call(withArguments: ["[ExpoIntents] Invalid URL: \(urlString)"])
      return
    }

    var request = URLRequest(url: url)
    if let data = optionsJson.data(using: .utf8),
       let options = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
      if let method = options["method"] as? String {
        request.httpMethod = method
      }
      if let headers = options["headers"] as? [String: String] {
        for (field, value) in headers {
          request.setValue(value, forHTTPHeaderField: field)
        }
      }
      if let body = options["body"] as? String {
        request.httpBody = body.data(using: .utf8)
      }
    }

    let task = URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
      guard let self else { return }
      self.queue.async {
        if let error {
          reject.call(withArguments: [error.localizedDescription])
          return
        }
        let http = response as? HTTPURLResponse
        let status = http?.statusCode ?? 0
        let body = data.flatMap { String(data: $0, encoding: .utf8) } ?? ""
        let result: [String: Any] = [
          "status": status,
          "ok": (200..<300).contains(status),
          "headers": (http?.allHeaderFields as? [String: String]) ?? [:],
          "body": body,
        ]
        resolve.call(withArguments: [result])
      }
    }
    task.resume()
  }

  private func getBundleScript() -> String? {
    if let bundleScript {
      return bundleScript
    }
    guard let bundleURL = Bundle.main.url(forResource: "ExpoIntents", withExtension: "bundle"),
          let bundle = Bundle(url: bundleURL),
          let url = bundle.url(forResource: "ExpoIntents", withExtension: "bundle"),
          let script = try? String(contentsOf: url, encoding: .utf8) else {
      return nil
    }
    bundleScript = script
    return script
  }

  private func getHandlerValue(name: String, source: String, in context: JSContext) -> JSValue? {
    if let cached = handlerCache[name] {
      return cached
    }
    context.exception = nil
    guard let value = context.evaluateScript("(\(source))"),
          !value.isUndefined,
          context.exception == nil else {
      return nil
    }
    handlerCache[name] = value
    return value
  }

  // MARK: - Helpers

  private func stringify(_ value: JSValue?, in context: JSContext) -> String {
    guard let value, !value.isUndefined, !value.isNull else {
      return ""
    }
    if value.isString {
      return value.toString() ?? ""
    }
    if let json = context.objectForKeyedSubscript("JSON"),
       let serialised = json.invokeMethod("stringify", withArguments: [value]),
       serialised.isString {
      return serialised.toString() ?? ""
    }
    return value.toString() ?? ""
  }

  private func exceptionMessage(_ context: JSContext) -> String? {
    guard let exception = context.exception else {
      return nil
    }
    context.exception = nil
    return exception.toString() ?? "Unknown JavaScript exception."
  }
}
