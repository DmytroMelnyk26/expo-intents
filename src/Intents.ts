import ExpoIntentsModule from './ExpoIntentsModule';

/**
 * The context passed as the second argument to an intent handler when it runs in the App Intents
 * runtime.
 */
export type IntentHandlerContext = {
  /** The `name` of the intent that triggered this handler. */
  intentName: string;
};

/**
 * An intent handler. Runs in a bare JavaScriptCore context (no React Native), so its body may
 * only use the runtime globals (`console`, `fetch`, `getSharedData`) plus its own arguments —
 * it cannot close over variables or imports from your app.
 */
export type IntentHandler<P extends object = object, R = unknown> = (
  params: P,
  context: IntentHandlerContext
) => R | Promise<R>;

/**
 * Registers the handler that runs when the App Intent named `name` is triggered (via Siri,
 * Spotlight, or the Shortcuts app) — even while the app is closed.
 *
 * The handler is serialised with `Function.prototype.toString()` and persisted to the App Group
 * store, so call this once while the app is running (e.g. on launch). `name` must match an intent
 * declared in the `expo-intents` config plugin options.
 *
 * @param name The intent name, matching the config plugin.
 * @param handler The function to run. Must be self-contained (see {@link IntentHandler}).
 */
export function registerIntentHandler<P extends object = object, R = unknown>(
  name: string,
  handler: IntentHandler<P, R>
): void {
  // The babel plugin replaces an `'intent'`-directive function with a source-code string at
  // compile time, so `handler` is a string here at runtime. We still accept a function for type
  // safety and DX. Fall back to `toString()` for environments that retain function source.
  const value = handler as unknown;
  const source = typeof value === 'string' ? value : (value as object).toString();
  ExpoIntentsModule.registerHandler(name, source);
}
