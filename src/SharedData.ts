import ExpoIntentsModule from './ExpoIntentsModule';

/**
 * Stores a JSON-serialisable value in the App Group store shared with the App Intents runtime.
 *
 * Use this to hand off app state (auth tokens, the current user, cached data, ...) that an
 * intent handler will need when it runs later — possibly while the app is closed.
 *
 * @param key Identifier to read the value back with.
 * @param value Any JSON-serialisable value.
 */
export function setSharedData<T>(key: string, value: T): void {
  ExpoIntentsModule.setSharedData(key, JSON.stringify(value));
}

/**
 * Reads a value previously stored with {@link setSharedData}.
 *
 * @param key The identifier used when storing.
 * @returns The parsed value, or `null` if nothing is stored under `key`.
 */
export function getSharedData<T>(key: string): T | null {
  const json = ExpoIntentsModule.getSharedData(key);
  if (json == null) {
    return null;
  }
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/**
 * Removes a value previously stored with {@link setSharedData}.
 * @param key The identifier used when storing.
 */
export function removeSharedData(key: string): void {
  ExpoIntentsModule.removeSharedData(key);
}
