/**
 * A user-facing string that can optionally be localised. A plain string is used as-is; a
 * `{ [locale]: string }` map provides per-language translations (Variant A localization).
 */
export type LocalizedString = string | Record<string, string>;

/**
 * Siri invocation phrases, optionally localised. An array is used as-is; a `{ [locale]: string[] }`
 * map gives per-language phrase lists. The lists correspond positionally, so each locale should
 * provide the same number of phrases as the source language.
 */
export type LocalizedPhrases = string[] | Record<string, string[]>;

/**
 * Splits a {@link LocalizedString} into the `base` value (the source-language string baked into the
 * generated Swift, also the string-catalog key) and the `translations` for other locales.
 */
export function resolveLocalized(
  value: LocalizedString,
  defaultLocale: string
): { base: string; translations: Record<string, string> } {
  if (typeof value === 'string') {
    return { base: value, translations: {} };
  }
  const sourceLocale = defaultLocale in value ? defaultLocale : Object.keys(value)[0];
  const base = value[sourceLocale] ?? '';
  const translations: Record<string, string> = {};
  for (const [locale, string] of Object.entries(value)) {
    if (locale !== sourceLocale) {
      translations[locale] = string;
    }
  }
  return { base, translations };
}

/**
 * Splits {@link LocalizedPhrases} into the `base` phrase list (source language) and, per base
 * phrase, the `translations` keyed by locale (positional correspondence with the base list).
 */
export function resolveLocalizedPhrases(
  value: LocalizedPhrases,
  defaultLocale: string
): { base: string[]; translations: Record<string, string>[] } {
  if (Array.isArray(value)) {
    return { base: value, translations: value.map(() => ({})) };
  }
  const sourceLocale = defaultLocale in value ? defaultLocale : Object.keys(value)[0];
  const base = value[sourceLocale] ?? [];
  const translations = base.map((_, index) => {
    const perPhrase: Record<string, string> = {};
    for (const [locale, phrases] of Object.entries(value)) {
      if (locale !== sourceLocale && phrases[index] != null) {
        perPhrase[locale] = phrases[index];
      }
    }
    return perPhrase;
  });
  return { base, translations };
}
