import { NativeModule, requireNativeModule } from 'expo';

declare class ExpoIntentsModule extends NativeModule {
  /**
   * Persists a serialised handler so the native App Intents runtime can execute it later,
   * outside the React Native process.
   * @param name Handler name; must match the intent's `name` in the config plugin.
   * @param source The handler serialised with `Function.prototype.toString()`.
   */
  registerHandler(name: string, source: string): void;
  /** Stores a JSON string in the App Group store under `key`. */
  setSharedData(key: string, json: string): void;
  /** Reads the JSON string stored under `key`, or `null` if absent. */
  getSharedData(key: string): string | null;
  /** Removes the value stored under `key`. */
  removeSharedData(key: string): void;
  /**
   * Persists a serialised entity-query function so the App Intents runtime can fetch/search the
   * app's entities. `method` is one of `'suggested'`, `'find'`, `'get'`.
   */
  registerEntityHandler(type: string, method: string, source: string): void;
}

export default requireNativeModule<ExpoIntentsModule>('ExpoIntents');
