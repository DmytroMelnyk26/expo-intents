import { ConfigPlugin, IOSConfig, withDangerousMod, withXcodeProject } from 'expo/config-plugins';
import fs from 'fs';
import path from 'path';

import { generateIntentsSwift } from './generateIntentsSwift';
import { IntentConfig, IntentEntityConfig } from '../types';

const GENERATED_DIR = 'Intents';
const GENERATED_FILE = 'ExpoGeneratedIntents.swift';

/**
 * Writes the generated `AppIntent` Swift file into the main app target's source group and adds
 * it to the build phase, so the App Intents compiler extracts its metadata.
 */
const withGeneratedIntentsSource: ConfigPlugin<{
  intents: IntentConfig[];
  entities: IntentEntityConfig[];
  defaultLocale: string;
}> = (config, { intents, entities, defaultLocale }) => {
  // 1. Write the Swift file to disk under <projectName>/Intents/.
  config = withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const projectName = cfg.modRequest.projectName!;
      const appName = cfg.name ?? projectName;
      const targetDir = path.join(cfg.modRequest.platformProjectRoot, projectName, GENERATED_DIR);
      await fs.promises.mkdir(targetDir, { recursive: true });
      await fs.promises.writeFile(
        path.join(targetDir, GENERATED_FILE),
        generateIntentsSwift(intents, entities, appName, defaultLocale)
      );
      return cfg;
    },
  ]);

  // 2. Register the file with the Xcode project's main target.
  config = withXcodeProject(config, (cfg) => {
    const projectName = cfg.modRequest.projectName!;
    const groupName = `${projectName}/${GENERATED_DIR}`;
    const filepath = `${groupName}/${GENERATED_FILE}`;

    if (!cfg.modResults.hasFile(filepath)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath,
        groupName,
        project: cfg.modResults,
      });
    }
    return cfg;
  });

  return config;
};

export default withGeneratedIntentsSource;
