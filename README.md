# expo-intents

Create **Apple App Intents** (Siri & Shortcuts) for your Expo app, with the handler logic written
in **JavaScript/TypeScript**.

Intents are declared in your app config and compiled into native Swift `AppIntent` structs at
prebuild time (App Intents metadata must exist at compile time). Each intent's logic runs your JS
handler inside a bare JavaScriptCore context — **no React Native runtime required**, so intents
work even when your app is closed. The approach mirrors how [`expo-widgets`](https://docs.expo.dev/versions/latest/sdk/widgets/)
runs widget UI off the RN runtime.

> **iOS only.** Android App Actions require the app to be running and have no background-execution
> equivalent.

## How it works

```
app.json (intents) ──prebuild──▶ generated Swift AppIntent structs ──▶ Siri / Shortcuts
                                          │ perform()
registerIntentHandler('name', fn) ──▶ App Group store ──▶ ExpoIntentsRunner (JSContext) ──▶ your JS handler
```

1. The **config plugin** turns each declared intent into a Swift `AppIntent` + `AppShortcutsProvider`.
2. **`registerIntentHandler`** serialises your handler (via a Babel transform) and persists it.
3. When the intent fires, the generated Swift calls into a `JSContext` that runs your handler and
   returns the result.

## Installation

```sh
npx expo install expo-intents
```

This package requires a **custom dev client / prebuild** (it adds native code and entitlements);
it does not work in Expo Go.

### 1. Add the config plugin

In `app.json` / `app.config.js`, declare your intents:

```json
{
  "expo": {
    "ios": { "bundleIdentifier": "com.you.app" },
    "plugins": [
      [
        "expo-intents",
        {
          "intents": [
            {
              "name": "getGreeting",
              "title": "Get Greeting",
              "description": "Returns a greeting for the saved user.",
              "phrases": ["Get greeting from ${applicationName}"]
            },
            {
              "name": "echo",
              "title": "Echo",
              "parameters": [{ "name": "message", "type": "string", "title": "Message" }]
            }
          ]
        }
      ]
    ]
  }
}
```

| Plugin option     | Description                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------- |
| `intents`         | The intents to generate (see below).                                                         |
| `groupIdentifier` | App Group shared with the intents runtime. Defaults to `group.<ios.bundleIdentifier>`.       |

**Intent fields:** `name` (must match `registerIntentHandler`), `title`, `description?`,
`parameters?` (`{ name, type?: 'string' | 'number' | 'boolean', title? }`), `phrases?` (use
`${applicationName}` for the app name).

The plugin adds the **App Groups** entitlement automatically. On a physical device, make sure
App Groups is enabled for your bundle id in your Apple Developer account.

### 2. Add the Babel plugin

Hermes strips function source at runtime, so handlers are serialised at **compile time**. Add the
plugin to `babel.config.js`:

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['expo-intents/babel-plugin'],
  };
};
```

### 3. Prebuild

```sh
npx expo prebuild -p ios
```

## Usage

### Registering a handler

Register handlers once while your app runs (e.g. on launch). Mark each handler with the
`'intent'` directive so the Babel plugin serialises it:

```ts
import { registerIntentHandler, setSharedData, getSharedData } from 'expo-intents';

export function registerIntents() {
  // Stash any state the handler will need later.
  setSharedData('user', 'Ada');

  registerIntentHandler('getGreeting', async (params, context) => {
    'intent';
    const user = getSharedData('user') ?? 'world';
    return `Hello, ${user}!`;
  });

  registerIntentHandler('echo', async (params) => {
    'intent';
    return `You said: ${params.message}`;
  });
}
```

> ⚠️ **Handlers run in a bare JavaScriptCore context**, isolated from your app. Their body may only
> use the runtime globals below plus their `(params, context)` arguments — they **cannot** close
> over variables, imports, or React state. Anything they need must be read via `getSharedData` or
> `fetch`.

### Runtime globals available inside a handler

| Global                   | Notes                                                                       |
| ------------------------ | --------------------------------------------------------------------------- |
| `console.log/info/warn/error` | Forwarded to the native log.                                           |
| `fetch(url, init?)`      | Minimal `fetch`; the response has `.status`, `.ok`, `.headers`, `.json()`, `.text()`. |
| `getSharedData<T>(key)`  | Reads a value stored with `setSharedData`. Synchronous.                     |

`params` are the intent's declared parameters; `context` is `{ intentName }`.

### Sharing data with handlers

```ts
import { setSharedData, getSharedData, removeSharedData } from 'expo-intents';

setSharedData('token', 'abc123'); // any JSON-serialisable value
const token = getSharedData<string>('token');
removeSharedData('token');
```

`setSharedData` is also how you pass app state (auth tokens, current user, …) to handlers that run
while the app is closed.

## API

### `registerIntentHandler(name, handler)`

Registers the handler for the intent named `name`. `handler` must be marked with the `'intent'`
directive. Persisted to the App Group store, so call it once per launch.

### `setSharedData(key, value)` / `getSharedData<T>(key)` / `removeSharedData(key)`

Read/write JSON-serialisable values in the App Group store shared with the intents runtime.

## Return values

Handlers currently return a **string** (objects are JSON-serialised). The value is exposed to
Shortcuts as the intent's result and can be chained into other actions.

## Limitations / roadmap

- iOS only.
- Parameter types: `string`, `number`, `boolean`. (Entities, enums, and optional parameters are
  on the roadmap.)
- Return type is always a string today; richer `IntentResult` shapes (dialogs, snippets) are
  planned.
- `EntityQuery`, `requestValue`, and `requestConfirmation` are not yet exposed.

## License

MIT
