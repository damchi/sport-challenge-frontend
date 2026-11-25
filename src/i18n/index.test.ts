import i18n from 'i18next';
import { FALLBACK_LANGUAGE, initI18n, loadLanguage, pickLanguage } from '.';

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

describe('loading the languages', () => {
  // Starts again from nothing (the setup of the tests loads both languages),
  // with a fresh copy of this module so that its texts can be mocked.
  async function freshStart() {
    vi.resetModules();
    const texts = await import('.');
    return { instance: i18n, ...texts };
  }
  afterEach(async () => {
    vi.doUnmock('./fr.json');
    vi.resetModules();
    // Back to the setup's state for the other tests.
    await initI18n('fr');
    await loadLanguage('en');
  });

  it('starts with the texts of the active language only', async () => {
    const { instance, initI18n } = await freshStart();

    await initI18n('en');

    expect(instance.t('errors.unknown')).toBe('Something went wrong. Try again.');
    // French has only the few startup texts that come with the app.
    expect(instance.exists('errors.unknown', { lng: 'fr', fallbackLng: false })).toBe(false);
  });

  it('downloads the other language when it is chosen, then applies it', async () => {
    const { instance, initI18n, changeLanguage } = await freshStart();
    await initI18n('en');

    await changeLanguage('fr');

    expect(instance.language).toBe('fr');
    expect(instance.t('errors.unknown')).toBe('Une erreur est survenue. Réessaie.');
  });

  it('keeps the texts added apart when the language comes after them', async () => {
    const { instance, initI18n, changeLanguage } = await freshStart();
    await initI18n('en');
    instance.addResourceBundle('fr', 'translation', { landing: { title: 'Accueil' } }, true);

    await changeLanguage('fr');

    expect(instance.t('landing.title')).toBe('Accueil');
    expect(instance.t('errors.unknown')).toBe('Une erreur est survenue. Réessaie.');
  });

  it('downloads a language once, and applies the one asked for last', async () => {
    const { instance, initI18n, changeLanguage } = await freshStart();
    await initI18n('en');
    const added = vi.spyOn(instance, 'addResourceBundle');

    const first = changeLanguage('fr');
    const last = changeLanguage('en');
    const again = changeLanguage('fr');

    expect(await Promise.all([first, last, again])).toEqual([true, false, true]);
    expect(instance.language).toBe('fr');
    expect(added).toHaveBeenCalledTimes(1);
  });

  it('leaves the current language when the other one cannot be downloaded', async () => {
    vi.doMock('./fr.json', () => {
      throw new Error('offline');
    });
    const { instance, initI18n, changeLanguage } = await freshStart();
    await initI18n('en');

    await expect(changeLanguage('fr')).rejects.toThrow();

    expect(instance.language).toBe('en');
    expect(instance.t('errors.unknown')).toBe('Something went wrong. Try again.');
  });

  it('can still say the app could not open when the language cannot be downloaded at start', async () => {
    vi.doMock('./fr.json', () => {
      throw new Error('offline');
    });
    const { instance, initI18n } = await freshStart();

    await expect(initI18n('fr')).rejects.toThrow();

    expect(instance.t('startup.unavailable')).toBe(
      "Impossible d'ouvrir l'application. Vérifie ta connexion et réessaie.",
    );
    expect(instance.t('startup.retry')).toBe('Réessayer');
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
