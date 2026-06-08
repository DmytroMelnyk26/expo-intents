import { NativeModule, requireNativeModule } from 'expo';

declare class ExpoIntentsModule extends NativeModule<{}> {}

export default requireNativeModule<ExpoIntentsModule>('ExpoIntents');
