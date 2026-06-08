import { registerWebModule, NativeModule } from 'expo';

// ExpoIntentsModule is not available on the web platform.
class ExpoIntentsModule extends NativeModule<{}> {}

export default registerWebModule(ExpoIntentsModule, 'ExpoIntentsModule');
