/** Value type of an intent parameter. Maps to a Swift `@Parameter` type and a JS `params` value. */
export type IntentParameterType = 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'entity';

/**
 * A choice for an `enum` parameter. A bare string uses the same text as both the stored value and
 * the display title; the object form lets you show a friendlier `title` in the Shortcuts editor.
 */
export type IntentEnumChoice = string | { value: string; title?: string };

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
  /**
   * Marks the parameter as optional (Swift `T?`). The handler receives `null` when the user
   * leaves it empty. Ignored when `default` is set (a default makes the parameter always present).
   */
  optional?: boolean;
  /**
   * Default value used when the user doesn't provide one. For `enum`, this must equal one of the
   * choice values. Not supported for `date`.
   */
  default?: string | number | boolean;
  /** The available choices. Required when `type` is `'enum'`. */
  choices?: IntentEnumChoice[];
  /**
   * The entity type name this parameter resolves to. Required when `type` is `'entity'`; must
   * match an entry in the plugin's `entities`. The handler receives the selected entity object.
   */
  entity?: string;
};

/**
 * Declarative description of an `AppEntity` type — a piece of the app's data the user can pick as
 * an intent parameter (a task, place, note, …). The config plugin generates the Swift `AppEntity`
 * and its `EntityQuery`, whose `suggested` / `find` / `get` methods delegate to the JS functions
 * registered with `registerEntityQuery(name, …)`.
 */
export type IntentEntityConfig = {
  /** Entity type name. Referenced by parameters via `entity` and by `registerEntityQuery`. */
  name: string;
  /** Type display name shown by the system. Defaults to `name`. */
  title?: string;
  /**
   * Whether the Shortcuts picker offers a search field backed by the JS `find` function
   * (Swift `EntityStringQuery`). Defaults to `true`.
   */
  searchable?: boolean;
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
  /** The entity types referenced by `entity` parameters. */
  entities?: IntentEntityConfig[];
};
