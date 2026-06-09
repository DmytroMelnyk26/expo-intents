import { LocalizedString, resolveLocalized, resolveLocalizedPhrases } from '../localized';
import { IntentConfig, IntentEntityConfig } from '../types';

/** base string → { locale: translated value }. */
type TranslationMap = Record<string, Record<string, string>>;

export type CollectedLocalizations = {
  /** Strings for the default `Localizable` table (titles, descriptions, parameter/enum/entity labels). */
  metadata: TranslationMap;
  /** Siri phrases for the special `AppShortcuts` table. */
  phrases: TranslationMap;
  /** Every locale referenced (including the source language). */
  locales: string[];
};

/**
 * Walks the intents/entities and collects every translation declared via `{ [locale]: … }` maps,
 * grouped into the two string-catalog tables App Intents uses (`Localizable` and `AppShortcuts`).
 */
export function collectLocalizations(
  intents: IntentConfig[],
  entities: IntentEntityConfig[],
  defaultLocale: string
): CollectedLocalizations {
  const metadata: TranslationMap = {};
  const phrases: TranslationMap = {};
  const locales = new Set<string>([defaultLocale]);

  const addMetadata = (value: LocalizedString | undefined) => {
    if (value == null) {
      return;
    }
    const { base, translations } = resolveLocalized(value, defaultLocale);
    const entries = Object.entries(translations);
    if (entries.length === 0) {
      return;
    }
    metadata[base] = { ...(metadata[base] ?? {}), ...translations };
    entries.forEach(([locale]) => locales.add(locale));
  };

  for (const intent of intents) {
    addMetadata(intent.title);
    addMetadata(intent.description);
    for (const parameter of intent.parameters ?? []) {
      addMetadata(parameter.title);
      if (parameter.type === 'enum') {
        for (const choice of parameter.choices ?? []) {
          if (typeof choice === 'object' && choice.title != null) {
            addMetadata(choice.title);
          }
        }
      }
    }
    if (intent.phrases != null) {
      const { base, translations } = resolveLocalizedPhrases(intent.phrases, defaultLocale);
      base.forEach((phrase, index) => {
        const perPhrase = translations[index];
        if (Object.keys(perPhrase).length === 0) {
          return;
        }
        phrases[phrase] = { ...(phrases[phrase] ?? {}), ...perPhrase };
        Object.keys(perPhrase).forEach((locale) => locales.add(locale));
      });
    }
  }

  for (const entity of entities) {
    addMetadata(entity.title);
  }

  return { metadata, phrases, locales: [...locales] };
}

/** Serialises a translation map into Xcode String Catalog (`.xcstrings`) JSON. */
export function buildXcstrings(sourceLanguage: string, entries: TranslationMap): string {
  const strings: Record<string, unknown> = {};
  for (const [key, translations] of Object.entries(entries)) {
    const localizations: Record<string, unknown> = {};
    for (const [locale, value] of Object.entries(translations)) {
      localizations[locale] = { stringUnit: { state: 'translated', value } };
    }
    strings[key] = { localizations };
  }
  return JSON.stringify({ sourceLanguage, strings, version: '1.0' }, null, 2);
}

/**
 * Pivots a phrases translation map into per-locale `{ phrase: value }` dictionaries. App Shortcut
 * phrases can't use `.xcstrings` below iOS 17, so they ship as legacy per-locale `.strings` files;
 * the source locale maps each phrase to itself, other locales to their translation (or the base).
 */
export function phraseStringsByLocale(
  phrases: TranslationMap,
  locales: string[],
  defaultLocale: string
): Record<string, Record<string, string>> {
  const byLocale: Record<string, Record<string, string>> = {};
  for (const locale of locales) {
    byLocale[locale] = {};
  }
  for (const [basePhrase, translations] of Object.entries(phrases)) {
    for (const locale of locales) {
      byLocale[locale][basePhrase] =
        locale === defaultLocale ? basePhrase : translations[locale] ?? basePhrase;
    }
  }
  return byLocale;
}

/** Serialises a `{ key: value }` map into legacy `.strings` (`"key" = "value";`) format. */
export function buildStringsFile(entries: Record<string, string>): string {
  const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return (
    Object.entries(entries)
      .map(([key, value]) => `"${escape(key)}" = "${escape(value)}";`)
      .join('\n') + '\n'
  );
}
