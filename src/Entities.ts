import ExpoIntentsModule from './ExpoIntentsModule';

/**
 * One entity returned by an entity-query function. `id` and `title` are required (the system uses
 * them to reference and display the entity); `subtitle` is shown as secondary text. Any extra
 * fields are passed through to the intent handler when the entity is selected as a parameter.
 */
export type EntityItem = {
  /** Stable identifier the system uses to re-fetch the entity for saved shortcuts. */
  id: string;
  /** Primary display text in the Shortcuts picker. */
  title: string;
  /** Optional secondary display text. */
  subtitle?: string;
  [key: string]: unknown;
};

/** Context passed as the last argument to every entity-query function. */
export type EntityQueryContext = {
  /** The device's current language as a BCP-47 tag (e.g. `"uk-UA"`), for localising titles. */
  locale: string;
};

/**
 * The functions that back an entity type's picker. Like intent handlers, each runs in the bare
 * App Intents runtime, so every function must be marked with the `'intent'` directive and may only
 * use the runtime globals (`console`, `fetch`, `getSharedData`) plus its arguments.
 */
export type EntityQueryHandlers = {
  /** Default suggestions shown before the user searches. */
  suggested?: (context: EntityQueryContext) => EntityItem[] | Promise<EntityItem[]>;
  /** Search results for the user's query. Omit to disable the search field. */
  find?: (query: string, context: EntityQueryContext) => EntityItem[] | Promise<EntityItem[]>;
  /** Resolves ids back into entities — required so saved shortcuts can rehydrate their selection. */
  get: (ids: string[], context: EntityQueryContext) => EntityItem[] | Promise<EntityItem[]>;
};

/**
 * Registers the query functions for an entity type declared in the `expo-intents` config plugin.
 * Call this once while the app runs; the functions are serialised and persisted, so they work
 * later even when the app is closed.
 *
 * @param typeName The entity type name, matching the plugin's `entities` and a parameter's `entity`.
 * @param handlers The `suggested` / `find` / `get` functions (see {@link EntityQueryHandlers}).
 */
export function registerEntityQuery(typeName: string, handlers: EntityQueryHandlers): void {
  const register = (method: string, fn: unknown) => {
    if (fn == null) {
      return;
    }
    // After the babel plugin, an `'intent'`-directive function is a source string at runtime.
    const source = typeof fn === 'string' ? fn : (fn as object).toString();
    ExpoIntentsModule.registerEntityHandler(typeName, method, source);
  };
  register('suggested', handlers.suggested);
  register('find', handlers.find);
  register('get', handlers.get);
}
