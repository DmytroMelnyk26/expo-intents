#!/usr/bin/env node

// Build the ExpoIntents.bundle (the JS runtime shim evaluated by ExpoIntentsRunner.swift).
// Run locally with `yarn build:bundle`; invoked automatically from an Xcode build phase via
// `scripts/xcode-build-bundle.sh`.

import spawn from '@expo/spawn-async';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';

const [, , possibleProjectRoot = process.cwd(), platform = 'ios', bundleOutput] = argv;

let projectRoot;
if (fs.existsSync(path.join(possibleProjectRoot, 'package.json'))) {
  projectRoot = possibleProjectRoot;
} else if (fs.existsSync(path.join(possibleProjectRoot, '..', 'package.json'))) {
  projectRoot = path.resolve(possibleProjectRoot, '..');
} else {
  throw new Error(
    `Unable to locate project (no package.json found) at path: ${possibleProjectRoot}`
  );
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(__dirname);

// NODE_BINARY is set for Xcode builds via the `with-node.sh` script.
const nodePath = process.env.NODE_BINARY || 'node';
const outputDir = path.join(__dirname, '../bundle/build');
const defaultBundleOutput = path.join(outputDir, 'ExpoIntents.bundle');
const appBundlePath = path.resolve(projectRoot, bundleOutput ?? defaultBundleOutput);

await fs.promises.rm(appBundlePath, { recursive: true, force: true });
await fs.promises.mkdir(path.dirname(appBundlePath), { recursive: true });

const result = await spawn(
  nodePath,
  [
    require.resolve('expo/bin/cli'),
    'export:embed',
    '--platform',
    platform,
    '--bundle-output',
    appBundlePath,
    '--entry-file',
    path.join(__dirname, '../bundle/index.ts'),
    '--dev',
    'false',
    '--skip-server',
  ],
  {
    stdio: 'inherit',
    cwd: projectRoot,
    env: {
      ...process.env,
      EXPO_OVERRIDE_METRO_CONFIG: path.join(__dirname, '../metro.config.js'),
    },
  }
);

if (result.error) {
  process.exit(1);
}
