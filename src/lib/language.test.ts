import i18n from 'i18next';
import { startLanguage } from './language';

describe('startLanguage', () => {
  let stop: (() => void) | undefined;
  afterEach(() => stop?.());

  it('starts in the device language and keeps the page lang attribute in step', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['fr-CA', 'en-US']);

    stop = startLanguage();
    expect(i18n.language).toBe('fr');
    expect(document.documentElement.lang).toBe('fr');

    await i18n.changeLanguage('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('reads navigator.language when the browser has no languages list', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(
      undefined as unknown as readonly string[],
    );
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('fr-FR');

    stop = startLanguage();

    expect(i18n.language).toBe('fr');
  });
});
