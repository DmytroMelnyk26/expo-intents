// Metro config used ONLY to build the standalone `ExpoIntents.bundle` (see
// `scripts/build-bundle.mjs`). It is passed to `expo export:embed` via
// `EXPO_OVERRIDE_METRO_CONFIG` and is independent of the host app's own metro.config.js.
//
// The bundle is a bare-JSContext runtime shim, so we override the project root to this
// package, drop polyfills, and replace native-only modules with lightweight stubs.

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = process.cwd();
const config = getDefaultConfig(projectRoot);

const expoStubPath = path.resolve(__dirname, './bundle/expo-stub.ts');
const expoModulesCoreStubPath = path.resolve(__dirname, './bundle/expo-modules-core-stub.ts');
const reactNativeStubPath = path.resolve(__dirname, './bundle/react-native-stub.ts');

// `projectRoot` won't be watched by default once we override it to `__dirname` (so we can
// bundle `expo-intents` itself as the main module). Re-add it unless it's already covered.
const watchFolders = config.watchFolders;
if (!watchFolders.some((entry) => !entry.startsWith(projectRoot))) {
  watchFolders.push(projectRoot);
}
// If expo-intents lives outside the user's project (symlinked / installed dependency), add
// its workspace root so Metro can resolve its dependencies.
const rel = path.relative(projectRoot, __dirname);
if (rel.startsWith('..') || path.isAbsolute(rel)) {
  try {
    const { resolveWorkspaceRoot } = require('resolve-workspace-root');
    const workspaceRoot = resolveWorkspaceRoot(__dirname);
    if (workspaceRoot && !watchFolders.includes(workspaceRoot)) {
      watchFolders.push(workspaceRoot);
    }
  } catch {
    // resolve-workspace-root is optional; skip when unavailable.
  }
}

const buildConfig = {
  ...config,
  projectRoot: __dirname, // Override root to be expo-intents.
  watchFolders,
  resolver: {
    ...config.resolver,
    resolveRequest(context, moduleName, platform) {
      const fileSpecifierRe = /^[\\/]|^\.\.?(?:$|[\\/])/i;
      if (fileSpecifierRe.test(moduleName)) {
        return context.resolveRequest(context, moduleName, platform);
      }
      switch (moduleName) {
        case 'expo':
          return { type: 'sourceFile', filePath: expoStubPath };
        case 'expo-modules-core':
          return { type: 'sourceFile', filePath: expoModulesCoreStubPath };
        case 'react-native':
          return { type: 'sourceFile', filePath: reactNativeStubPath };
        case 'react-native-worklets':
        case 'react-native-reanimated':
          return { type: 'empty' };
        default:
          return context.resolveRequest(context, moduleName, platform);
      }
    },
  },
  transformer: {
    ...config.transformer,
    enableBabelRCLookup: false,
    getTransformOptions: async () => ({
      transform: { experimentalImportSupport: false, inlineRequires: false },
    }),
  },
  serializer: {
    ...config.serializer,
    getPolyfills: () => [],
  },
};

module.exports = buildConfig;
