import { ConfigPlugin, createRunOncePlugin } from 'expo/config-plugins';

import withIosIntents from './ios/withIosIntents';
import { ExpoIntentsConfigPluginProps } from './types';

const pkg = require('../../package.json');

const withIntents: ConfigPlugin<ExpoIntentsConfigPluginProps | undefined> = (config, props) => {
  // iOS-only: Android App Actions have no background-execution equivalent.
  return withIosIntents(config, {
    intents: props?.intents ?? [],
    entities: props?.entities ?? [],
    groupIdentifier: props?.groupIdentifier,
  });
};

export default createRunOncePlugin(withIntents, pkg.name, pkg.version);
