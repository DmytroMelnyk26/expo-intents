import { ConfigPlugin, IOSConfig, withDangerousMod, withInfoPlist, withXcodeProject } from 'expo/config-plugins';
import fs from 'fs';
import path from 'path';

import {
  buildStringsFile,
  buildXcstrings,
  collectLocalizations,
  phraseStringsByLocale,
} from './generateLocalizations';
import { IntentConfig, IntentEntityConfig } from '../types';

const METADATA_FILE = 'Localizable.xcstrings';
const PHRASES_FILE = 'AppShortcuts.strings';

/**
 * Generates the localization resources from any localized config values, adds them to the app
 * target, and registers the locales (knownRegions + CFBundleLocalizations) so iOS offers them.
 *
 * - Metadata (titles, descriptions, parameter/enum/entity labels) → `Localizable.xcstrings`.
 * - Siri phrases → legacy per-locale `<locale>.lproj/AppShortcuts.strings` (the `.xcstrings`
 *   form of AppShortcuts requires iOS 17; the legacy `.strings` works from iOS 16).
 */
const withGeneratedLocalizations: ConfigPlugin<{
  intents: IntentConfig[];
  entities: IntentEntityConfig[];
  defaultLocale: string;
}> = (config, { intents, entities, defaultLocale }) => {
  const { metadata, phrases, locales } = collectLocalizations(intents, entities, defaultLocale);
  const hasMetadata = Object.keys(metadata).length > 0;
  const hasPhrases = Object.keys(phrases).length > 0;

  if (!hasMetadata && !hasPhrases) {
    return config; // nothing localized — skip entirely.
  }

  const phrasesByLocale = phraseStringsByLocale(phrases, locales, defaultLocale);

  // 1. Write the resource files into the app target's source group.
  config = withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const projectName = cfg.modRequest.projectName!;
      const dir = path.join(cfg.modRequest.platformProjectRoot, projectName);
      await fs.promises.mkdir(dir, { recursive: true });

      if (hasMetadata) {
        await fs.promises.writeFile(
          path.join(dir, METADATA_FILE),
          buildXcstrings(defaultLocale, metadata)
        );
      }
      if (hasPhrases) {
        for (const locale of locales) {
          const lprojDir = path.join(dir, `${locale}.lproj`);
          await fs.promises.mkdir(lprojDir, { recursive: true });
          await fs.promises.writeFile(
            path.join(lprojDir, PHRASES_FILE),
            buildStringsFile(phrasesByLocale[locale])
          );
        }
      }
      return cfg;
    },
  ]);

  // 2. Add the resources to the Xcode project and register the locales.
  config = withXcodeProject(config, (cfg) => {
    const projectName = cfg.modRequest.projectName!;
    for (const locale of locales) {
      cfg.modResults.addKnownRegion(locale);
    }

    const addResource = (filepath: string, groupName: string) => {
      if (!cfg.modResults.hasFile(filepath)) {
        IOSConfig.XcodeUtils.addResourceFileToGroup({
          filepath,
          groupName,
          isBuildFile: true,
          project: cfg.modResults,
        });
      }
    };

    if (hasMetadata) {
      addResource(`${projectName}/${METADATA_FILE}`, projectName);
    }
    if (hasPhrases) {
      for (const locale of locales) {
        // The `.lproj` path is what makes Xcode treat the file as a localized variant.
        addResource(
          `${projectName}/${locale}.lproj/${PHRASES_FILE}`,
          `${projectName}/${locale}.lproj`
        );
      }
    }
    return cfg;
  });

  // 3. Advertise the supported localizations so iOS picks them up.
  config = withInfoPlist(config, (cfg) => {
    const existing = Array.isArray(cfg.modResults.CFBundleLocalizations)
      ? (cfg.modResults.CFBundleLocalizations as string[])
      : [];
    cfg.modResults.CFBundleLocalizations = Array.from(new Set([...existing, ...locales]));
    return cfg;
  });

  return config;
};

export default withGeneratedLocalizations;
