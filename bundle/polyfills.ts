// Polyfills installed into the bare `JSContext` global before any handler runs.
//
// JavaScriptCore gives us ECMAScript (Promise, JSON, ...) but none of the host APIs a handler
// typically needs (console, fetch, app state, ...). We bridge those to native primitives that
// `ExpoIntentsRunner.swift` injects with `JSContext.setObject(_:forKeyedSubscript:)` BEFORE this
// bundle is evaluated, so they are already present when `installPolyfills` runs.
//
// Native primitives (all prefixed `__expoIntents`):
//   __expoIntentsLog(level, message)            -> void
//   __expoIntentsGetSharedData(key)             -> string | null   (JSON string)
//   __expoIntentsNativeFetch(url, optionsJson)  -> Promise<NativeResponse>

type Global = Record<string, unknown>;

type NativeLog = (level: string, message: string) => void;
type NativeGetSharedData = (key: string) => string | null;
type NativeResponse = {
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  body: string;
};
type NativeFetch = (url: string, optionsJson: string) => Promise<NativeResponse>;

export function installPolyfills(global: Global): void {
  installConsole(global);
  installSharedData(global);
  installFetch(global);
}

function installConsole(global: Global): void {
  if (global.console) {
    return;
  }
  const nativeLog = global.__expoIntentsLog as NativeLog | undefined;
  const log = (level: string) => (...args: unknown[]) => {
    if (typeof nativeLog !== 'function') {
      return;
    }
    nativeLog(level, args.map(stringify).join(' '));
  };
  global.console = {
    log: log('log'),
    info: log('info'),
    warn: log('warn'),
    error: log('error'),
    debug: log('debug'),
  };
}

function installSharedData(global: Global): void {
  const native = global.__expoIntentsGetSharedData as NativeGetSharedData | undefined;
  // Reads app state stashed with `setSharedData` while the app was running. Synchronous —
  // App Group UserDefaults access is cheap.
  global.getSharedData = <T>(key: string): T | null => {
    if (typeof native !== 'function') {
      return null;
    }
    const json = native(key);
    if (json == null) {
      return null;
    }
    try {
      return JSON.parse(json) as T;
    } catch {
      return null;
    }
  };
}

function installFetch(global: Global): void {
  const nativeFetch = global.__expoIntentsNativeFetch as NativeFetch | undefined;
  if (typeof nativeFetch !== 'function' || global.fetch) {
    return;
  }
  global.fetch = async (input: string, init?: RequestInit): Promise<MinimalResponse> => {
    const url = String(input);
    const optionsJson = JSON.stringify({
      method: init?.method ?? 'GET',
      headers: normaliseHeaders(init?.headers),
      body: typeof init?.body === 'string' ? init.body : null,
    });
    const res = await nativeFetch(url, optionsJson);
    return makeResponse(res);
  };
}

type RequestInit = {
  method?: string;
  headers?: Record<string, string> | [string, string][];
  body?: unknown;
};

type MinimalResponse = {
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  text: () => Promise<string>;
  json: <T>() => Promise<T>;
};

function makeResponse(res: NativeResponse): MinimalResponse {
  return {
    status: res.status,
    ok: res.ok,
    headers: res.headers ?? {},
    text: () => Promise.resolve(res.body),
    json: <T>() => Promise.resolve(JSON.parse(res.body) as T),
  };
}

function normaliseHeaders(
  headers?: Record<string, string> | [string, string][]
): Record<string, string> {
  if (!headers) {
    return {};
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  return headers;
}

function stringify(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
