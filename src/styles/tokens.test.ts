import tokensCss from './tokens.css?raw';

type Palette = Map<string, string>;

function colorsIn(block: string): Palette {
  const palette: Palette = new Map();
  for (const match of block.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-f]{6});/g)) {
    const [, name, value] = match;
    if (name && value) palette.set(name, value);
  }
  return palette;
}

const darkStart = tokensCss.indexOf('@media (prefers-color-scheme: dark)');
const themes = {
  light: colorsIn(tokensCss.slice(0, darkStart)),
  dark: colorsIn(tokensCss.slice(darkStart)),
};

function channel(hex: string, offset: number): number {
  const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

function contrast(a: string, b: string): number {
  const high = Math.max(luminance(a), luminance(b));
  const low = Math.min(luminance(a), luminance(b));
  return (high + 0.05) / (low + 0.05);
}

// Text on background pairs of docs/design/design.md, each above 4.5:1.
const textPairs: [text: string, background: string][] = [
  ['ink', 'bg'],
  ['ink', 'surface'],
  ['muted', 'bg'],
  ['muted', 'surface'],
  ['muted', 'segment'],
  ['ink', 'segment'],
  ['on-hero', 'hero'],
  ['on-dark-muted', 'hero'],
  ['accent', 'surface'],
  ['accent', 'bg'],
  ['accent', 'accent-soft'],
  ['on-accent', 'accent'],
  ['ink', 'accent-soft'],
  ['risk-fg', 'risk-bg'],
  ['ok-fg', 'ok-bg'],
  ['out-fg', 'out-bg'],
  ...[1, 2, 3, 4, 5, 6].map((n): [string, string] => [`avatar-${n}-fg`, `avatar-${n}-bg`]),
];

describe('design tokens', () => {
  it('redefines every light color in the dark theme', () => {
    expect(darkStart).toBeGreaterThan(0);
    expect([...themes.dark.keys()].sort()).toEqual([...themes.light.keys()].sort());
  });

  describe.each(Object.entries(themes))('%s theme', (_, palette) => {
    it.each(textPairs)('%s on %s reaches 4.5:1', (text, background) => {
      const textColor = palette.get(text);
      const backgroundColor = palette.get(background);
      if (!textColor || !backgroundColor) throw new Error(`Missing token ${text} or ${background}`);
      expect(contrast(textColor, backgroundColor)).toBeGreaterThanOrEqual(4.5);
    });
  });
});
