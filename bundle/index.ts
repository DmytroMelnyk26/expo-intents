/* eslint-disable no-var */

// Entry point for the ExpoIntents JS bundle.
//
// Metro bundles this file (see `metro.config.js`) into a single `ExpoIntents.bundle`,
// which is evaluated inside a bare JavaScriptCore `JSContext` by `ExpoIntentsRunner.swift`.
//
// IMPORTANT: there is NO React Native / Hermes runtime here. App Intents run in a process
// where the RN bridge is not available, so this bundle must stay self-contained: plain JS
// plus the native primitives that Swift injects into the context (see `polyfills.ts`).
//
// The bundle is a fixed runtime shim — it does NOT contain user handler code. The user's
// handler is serialised with `Function.prototype.toString()` on the JS side, persisted to
// the App Group store, and at execution time Swift evaluates it and assigns it to
// `globalThis.__expoIntentHandler` before calling `__expoIntentPerform`.

import { installPolyfills } from './polyfills';

type Json = Record<string, unknown>;

declare global {
  // Set by Swift immediately before each call: the user's deserialised handler.
  var __expoIntentHandler: ((params: Json, context: Json) => unknown) | undefined;
  // Called by Swift to execute the current handler. Always resolves through a Promise so the
  // Swift runner can `await` sync and async handlers uniformly.
  var __expoIntentPerform: (params: Json, context: Json) => Promise<unknown>;
}

installPolyfills(globalThis as unknown as Record<string, unknown>);

const __expoIntentPerform = function (params: Json, context: Json): Promise<unknown> {
  const handler = globalThis.__expoIntentHandler;
  if (typeof handler !== 'function') {
    return Promise.reject(
      new Error('[ExpoIntents] No intent handler was provided to the runtime.')
    );
  }
  // Normalise sync and async handlers (and thrown errors) into a single Promise.
  return Promise.resolve().then(() => handler(params, context));
};

Object.assign(globalThis, {
  __expoIntentPerform,
});
