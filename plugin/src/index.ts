import { ExpoIntentsConfigPluginProps as Props } from './types';

export default (props: Props = {}): [string, Props] => ['expo-intents', props];
