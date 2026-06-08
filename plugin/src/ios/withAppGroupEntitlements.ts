import { ConfigPlugin, withEntitlementsPlist, withInfoPlist } from 'expo/config-plugins';

const APP_GROUP_KEY = 'com.apple.security.application-groups';

/**
 * Adds the App Group entitlement to the main app and records the group identifier in Info.plist
 * (`ExpoIntentsAppGroup`) so the runtime (`IntentsStorage`) can open the shared `UserDefaults`.
 */
const withAppGroupEntitlements: ConfigPlugin<{ groupIdentifier: string }> = (
  config,
  { groupIdentifier }
) => {
  config = withEntitlementsPlist(config, (cfg) => {
    const existing = cfg.modResults[APP_GROUP_KEY];
    const groups = Array.isArray(existing) ? (existing as string[]) : [];
    if (!groups.includes(groupIdentifier)) {
      groups.push(groupIdentifier);
    }
    cfg.modResults[APP_GROUP_KEY] = groups;
    return cfg;
  });

  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.ExpoIntentsAppGroup = groupIdentifier;
    return cfg;
  });

  return config;
};

export default withAppGroupEntitlements;
