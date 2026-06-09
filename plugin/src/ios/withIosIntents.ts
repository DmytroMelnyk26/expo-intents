import { ConfigPlugin, withPlugins } from 'expo/config-plugins';

import withAppGroupEntitlements from './withAppGroupEntitlements';
import withGeneratedIntentsSource from './withGeneratedIntentsSource';
import withGeneratedLocalizations from './withGeneratedLocalizations';
import { IntentConfig, IntentEntityConfig } from '../types';

type IosIntentsProps = {
  intents: IntentConfig[];
  entities: IntentEntityConfig[];
  defaultLocale: string;
  groupIdentifier?: string;
};

const withIosIntents: ConfigPlugin<IosIntentsProps> = (config, props) => {
  const bundleIdentifier = config.ios?.bundleIdentifier;
  if (!bundleIdentifier) {
    throw new Error(
      'expo-intents: `ios.bundleIdentifier` is required. Set it in app.json / app.config.js.'
    );
  }

  const groupIdentifier = props.groupIdentifier ?? `group.${bundleIdentifier}`;

  const { intents, entities, defaultLocale } = props;

  return withPlugins(config, [
    [withAppGroupEntitlements, { groupIdentifier }],
    [withGeneratedIntentsSource, { intents, entities, defaultLocale }],
    [withGeneratedLocalizations, { intents, entities, defaultLocale }],
  ]);
};

export default withIosIntents;
