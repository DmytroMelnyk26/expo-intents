// Stub for `expo` inside the App Intents bundle. The native module surface is unavailable in
// the bare JSContext, so any incidental import resolves to inert no-ops.
export function requireNativeModule(_name: string) {
  return {};
}

export function requireOptionalNativeModule(_name: string) {
  return undefined;
}
