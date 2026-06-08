import { registerWebModule, NativeModule } from 'expo';

// App Intents are iOS-only. On web these are no-ops backed by an in-memory map so calls don't
// throw during universal rendering.
class ExpoIntentsModule extends NativeModule {
  private store: Record<string, string> = {};

  registerHandler(_name: string, _source: string): void {}

  setSharedData(key: string, json: string): void {
    this.store[key] = json;
  }

  getSharedData(key: string): string | null {
    return key in this.store ? this.store[key] : null;
  }

  removeSharedData(key: string): void {
    delete this.store[key];
  }
}

export default registerWebModule(ExpoIntentsModule, 'ExpoIntentsModule');
