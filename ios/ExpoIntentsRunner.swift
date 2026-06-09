import Foundation
import JavaScriptCore

/// Executes user JavaScript (intent handlers and entity-query functions) inside a bare `JSContext`.
///
/// App Intents run in a process without a live React Native runtime, so we evaluate the standalone
/// `ExpoIntents.bundle` (built by Metro — see `scripts/build-bundle.mjs`) once, then for each call:
///   1. read the serialised function source from the App Group store,
///   2. evaluate it to a function value (cached, re-evaluated when the source changes),
///   3. call it through `globalThis.__expoIntentInvoke(fn, args)` and await the returned Promise.
///
/// The generated Swift `AppIntent` / `EntityQuery` types call `perform(handler:params:)` and
/// `queryEntities(type:method:arg:)` respectively.
public final class ExpoIntentsRunner {
  public static let shared = ExpoIntentsRunner()

  private let queue = DispatchQueue(label: "expo.intents.runner")
  private var context: JSContext?
  private var bundleScript: String?
  // Cached per call site, tagged with the source it was evaluated from. When the stored source
  // changes (e.g. Fast Refresh re-registers an edited function), we re-evaluate instead of serving
  // the stale value — so editing JS takes effect on the next trigger without a rebuild.
  private var functionCache: [String: (source: String, value: JSValue)] = [:]

  private init() {}

  // MARK: - Public API

  /// Runs the intent handler registered under `name` and returns its result as a string (objects
  /// are JSON-serialised). Throws if the handler is missing or the JS rejects/throws.
  public func perform(handler name: String, params: [String: Any]) async throws -> String {
    guard let source = IntentsStorage.shared.handlerSource(for: name) else {
      throw ExpoIntentsError(message: "No registered handler for intent '\(name)'.")
    }
    let context: [String: Any] = ["intentName": name, "locale": currentLocale()]
    let value = try await callFunction(source: source, cacheKey: "handler.\(name)", args: [params, context])
    return stringify(value)
  }

  /// Runs an entity-query method (`suggested` / `find` / `get`) registered for `type` and returns
  /// the resulting array of entity dictionaries. Returns `[]` when the method isn't registered.
  public func queryEntities(type: String, method: String, arg: Any?) async throws -> [[String: Any]] {
    guard let source = IntentsStorage.shared.entityQuerySource(type: type, method: method) else {
      return []
    }
    // The query's own argument (string / [String]) comes first, then a context object — so the JS
    // signatures are `suggested(ctx)`, `find(query, ctx)`, `get(ids, ctx)`.
    var args: [Any] = arg.map { [$0] } ?? []
    args.append(["locale": currentLocale()])
    let value = try await callFunction(source: source, cacheKey: "entity.\(type).\(method)", args: args)
    guard let array = value?.toArray() else {
      return []
    }
    return array.compactMap { $0 as? [String: Any] }
  }

  // MARK: - JS invocation

  private func callFunction(source: String, cacheKey: String, args: [Any]) async throws -> JSValue? {
    try await withCheckedThrowingContinuation { continuation in
      queue.async {
        self.invoke(source: source, cacheKey: cacheKey, args: args, continuation: continuation)
      }
    }
  }

  private func invoke(
    source: String,
    cacheKey: String,
    args: [Any],
    continuation: CheckedContinuation<JSValue?, Error>
  ) {
    guard let context = getContext() else {
      continuation.resume(throwing: ExpoIntentsError(message: "Could not create a JSContext."))
      return
    }
    guard let function = getCachedFunction(cacheKey: cacheKey, source: source, in: context) else {
      let message = exceptionMessage(context) ?? "Could not evaluate function for '\(cacheKey)'."
      continuation.resume(throwing: ExpoIntentsError(message: message))
      return
    }
    guard let invoke = context.objectForKeyedSubscript("__expoIntentInvoke"), invoke.isObject else {
      continuation.resume(
        throwing: ExpoIntentsError(message: "ExpoIntents runtime is not initialised (__expoIntentInvoke missing).")
      )
      return
    }

    context.exception = nil
    var didResume = false
    let resolve: @convention(block) (JSValue?) -> Void = { value in
      guard !didResume else { return }
      didResume = true
      continuation.resume(returning: value)
    }
    let reject: @convention(block) (JSValue?) -> Void = { error in
      guard !didResume else { return }
      didResume = true
      let message = error?.toString() ?? "JavaScript function rejected."
      continuation.resume(throwing: ExpoIntentsError(message: message))
    }

    let promise = invoke.call(withArguments: [function, args])
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

  private func getCachedFunction(cacheKey: String, source: String, in context: JSContext) -> JSValue? {
    if let cached = functionCache[cacheKey], cached.source == source {
      return cached.value
    }
    context.exception = nil
    guard let value = context.evaluateScript("(\(source))"),
          !value.isUndefined,
          context.exception == nil else {
      return nil
    }
    functionCache[cacheKey] = (source, value)
    return value
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

  // MARK: - Helpers

  /// The device's current language as a BCP-47 tag (e.g. "uk-UA"), passed to JS so handlers and
  /// entity queries can localise their dynamic output.
  private func currentLocale() -> String {
    Locale.preferredLanguages.first ?? Locale.current.identifier
  }

  private func stringify(_ value: JSValue?) -> String {
    guard let value, !value.isUndefined, !value.isNull else {
      return ""
    }
    if value.isString {
      return value.toString() ?? ""
    }
    if let context = value.context,
       let json = context.objectForKeyedSubscript("JSON"),
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
