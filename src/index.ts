// Reexport the native module. On web, it will be resolved to ExpoIntentsModule.web.ts
// and on native platforms to ExpoIntentsModule.ts
export { default } from './ExpoIntentsModule';
export * from './ExpoIntents.types';
export { setSharedData, getSharedData, removeSharedData } from './SharedData';
export { registerIntentHandler } from './Intents';
export type { IntentHandler, IntentHandlerContext } from './Intents';
export { registerEntityQuery } from './Entities';
export type { EntityItem, EntityQueryContext, EntityQueryHandlers } from './Entities';
