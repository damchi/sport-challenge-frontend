import { setThemeChoice, startTheme } from './theme';

function mockDevice(dark: boolean) {
  const listeners: (() => void)[] = [];
  const media = {
    matches: dark,
    addEventListener: (_: string, listener: () => void) => listeners.push(listener),
  };
  vi.stubGlobal('matchMedia', () => media);
  return {
    switchTo(next: boolean) {
      media.matches = next;
      listeners.forEach((listener) => listener());
    },
  };
}

describe('theme', () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('follows the device by default, also when it changes', () => {
    const device = mockDevice(true);

    startTheme();
    expect(document.documentElement.dataset.theme).toBe('dark');

    device.switchTo(false);
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('applies and keeps a manual choice on the device', () => {
    mockDevice(true);
    startTheme();

    setThemeChoice('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('sport-challenge:theme')).toBe('light');

    // A new page load reads the kept choice.
    startTheme();
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('forgets the choice when going back to the device theme', () => {
    mockDevice(true);
    setThemeChoice('light');

    setThemeChoice('system');

    expect(localStorage.getItem('sport-challenge:theme')).toBeNull();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
