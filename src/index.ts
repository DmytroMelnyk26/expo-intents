// Reexport the native module. On web, it will be resolved to ExpoIntentsModule.web.ts
// and on native platforms to ExpoIntentsModule.ts
export { default } from './ExpoIntentsModule';
export * from './ExpoIntents.types';
