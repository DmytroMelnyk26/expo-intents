/** Value type of an intent parameter. Maps to a Swift `@Parameter` type and a JS `params` value. */
export type IntentParameterType = 'string' | 'number' | 'boolean';

/**
 * A single parameter exposed by an App Intent. The system surfaces these in the Shortcuts app
 * and (for unresolved values) prompts the user for input.
 */
export type IntentParameter = {
  /** Parameter name. Becomes the Swift `@Parameter` property and the JS `params` key. */
  name: string;
  /** The parameter's value type. Defaults to `string`. */
  type?: IntentParameterType;
  /** Title shown in the Shortcuts editor. Defaults to `name`. */
  title?: string;
};

/**
 * Declarative description of one App Intent. The config plugin turns each entry into a Swift
 * `AppIntent` struct at prebuild time (App Intents metadata must exist at compile time), whose
 * `perform()` runs the JS handler registered under the matching `name`.
 */
export type IntentConfig = {
  /**
   * Unique handler key. Must match the name passed to `registerIntentHandler(name, fn)` on the
   * JS side. Also used to derive the Swift struct name.
   */
  name: string;
  /** Human-readable title shown in Shortcuts / Spotlight / Siri. */
  title: string;
  /** Optional longer description shown in the Shortcuts editor. */
  description?: string;
  /** Parameters the intent accepts. */
  parameters?: IntentParameter[];
  /**
   * Siri / Spotlight invocation phrases for the auto-registered AppShortcut. Use the
   * `${applicationName}` placeholder to insert the app name, e.g. `"Book parking with ${applicationName}"`.
   */
  phrases?: string[];
};

export type ExpoIntentsConfigPluginProps = {
  /**
   * App Group identifier shared between the main app and the App Intents runtime. Defaults to
   * `group.<ios.bundleIdentifier>`.
   */
  groupIdentifier?: string;
  /** The intents to generate. */
  intents?: IntentConfig[];
};
