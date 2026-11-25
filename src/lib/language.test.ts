import i18n from 'i18next';
import { initI18n, loadLanguage } from '../i18n';
import { startLanguage } from './language';

describe('startLanguage', () => {
  let stop: (() => void) | undefined;
  afterEach(async () => {
    stop?.();
    // Back to the setup's state: starting again drops the texts loaded.
    await initI18n('fr');
    await loadLanguage('en');
  });

  it('starts in the device language and keeps the page lang attribute in step', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-CA', 'fr-FR']);

    stop = await startLanguage();
    expect(i18n.language).toBe('en');
    expect(i18n.t('errors.unknown')).toBe('Something went wrong. Try again.');
    expect(document.documentElement.lang).toBe('en');

    await i18n.changeLanguage('fr');
    expect(document.documentElement.lang).toBe('fr');
  });

  it('reads navigator.language when the browser has no languages list', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(
      undefined as unknown as readonly string[],
    );
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('fr-FR');

    stop = await startLanguage();

    expect(i18n.language).toBe('fr');
  });
});
