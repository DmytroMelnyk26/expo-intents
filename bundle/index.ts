/* eslint-disable no-var */

// Entry point for the ExpoIntents JS bundle.
//
// Metro bundles this file (see `metro.config.js`) into a single `ExpoIntents.bundle`,
// which is evaluated inside a bare JavaScriptCore `JSContext` by `ExpoIntentsRunner.swift`.
//
// IMPORTANT: there is NO React Native / Hermes runtime here. App Intents run in a process
// where the RN bridge is not available, so this bundle must stay self-contained: plain JS
// plus the native primitives that Swift injects (see `polyfills.ts`).
//
// The bundle is a fixed runtime shim — it does NOT contain user code. User functions (intent
// handlers and entity-query functions) are serialised with the babel plugin, persisted, then
// at execution time Swift evaluates a function from its source and calls it via
// `__expoIntentInvoke`, which normalises sync/async results into a Promise the runner awaits.

import { installPolyfills } from './polyfills';

declare global {
  // Called by Swift to run a user function (handler or entity query). Always returns a Promise,
  // so the Swift runner can `await` sync and async functions uniformly.
  var __expoIntentInvoke: (
    fn: (...args: unknown[]) => unknown,
    args: unknown[]
  ) => Promise<unknown>;
}

installPolyfills(globalThis as unknown as Record<string, unknown>);

const __expoIntentInvoke = function (
  fn: (...args: unknown[]) => unknown,
  args: unknown[]
): Promise<unknown> {
  // Normalise sync and async functions (and synchronously thrown errors) into a single Promise.
  return Promise.resolve().then(() => fn.apply(undefined, args));
};

Object.assign(globalThis, {
  __expoIntentInvoke,
});
