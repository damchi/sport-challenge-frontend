import i18n from 'i18next';
import { FALLBACK_LANGUAGE, pickLanguage } from '.';

describe('pickLanguage', () => {
  it('keeps the first supported language of the device, whatever its region', () => {
    expect(pickLanguage(['fr-CA', 'en-US'])).toBe('fr');
    expect(pickLanguage(['en-GB'])).toBe('en');
    expect(pickLanguage(['es-ES', 'FR'])).toBe('fr');
  });

  it('falls back on English for any other language', () => {
    expect(FALLBACK_LANGUAGE).toBe('en');
    expect(pickLanguage(['es-ES', 'de'])).toBe('en');
    expect(pickLanguage([])).toBe('en');
  });
});

describe('plurals and variables', () => {
  // A throwaway instance: the plural rules are the languages', not the app's texts.
  const t = (language: string, count: number) => {
    const instance = i18n.cloneInstance({ lng: language });
    instance.addResourceBundle(language, 'test', {
      km_one: '{{count}} km parcouru',
      km_other: '{{count}} km parcourus',
    });
    return instance.t('km', { ns: 'test', count });
  };

  it('uses the French rule: 0 and 1 are singular', () => {
    expect(t('fr', 0)).toBe('0 km parcouru');
    expect(t('fr', 1)).toBe('1 km parcouru');
    expect(t('fr', 2)).toBe('2 km parcourus');
  });

  it('uses the English rule: only 1 is singular', () => {
    expect(t('en', 0)).toBe('0 km parcourus');
    expect(t('en', 1)).toBe('1 km parcouru');
  });

  it('translates the unknown error fallback key in both languages', () => {
    for (const language of ['fr', 'en']) {
      expect(i18n.exists('errors.unknown', { lng: language, fallbackLng: false })).toBe(true);
    }
  });
});
