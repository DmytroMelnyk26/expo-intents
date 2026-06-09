import { ConfigPlugin, withPlugins } from 'expo/config-plugins';

import withAppGroupEntitlements from './withAppGroupEntitlements';
import withGeneratedIntentsSource from './withGeneratedIntentsSource';
import { IntentConfig, IntentEntityConfig } from '../types';

type IosIntentsProps = {
  intents: IntentConfig[];
  entities: IntentEntityConfig[];
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

  return withPlugins(config, [
    [withAppGroupEntitlements, { groupIdentifier }],
    [withGeneratedIntentsSource, { intents: props.intents, entities: props.entities }],
  ]);
};

export default withIosIntents;
