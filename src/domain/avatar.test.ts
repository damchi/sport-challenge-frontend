import { avatarColor, initials } from './avatar';

describe('initials', () => {
  it.each([
    ['marie_92', 'MA'],
    ['jean.luc', 'JL'],
    ['Hugo', 'HU'],
    ['x', 'X'],
    ['__a', 'A'],
    ['  jean.luc ', 'JL'],
    ['Marie Tremblay', 'MT'],
    ['Marie-Ève Tremblay', 'MT'],
    ['Jean-Paul', 'JP'],
    ['Éloïse N’Diaye', 'ÉN'],
  ])('%s gives %s', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});

describe('avatarColor', () => {
  it('gives the same colour to the same user, between 1 and 6', () => {
    const color = avatarColor('6f1c2a8e-3b5d-4e7f-9a0b-1c2d3e4f5a6b');

    expect(avatarColor('6f1c2a8e-3b5d-4e7f-9a0b-1c2d3e4f5a6b')).toBe(color);
    expect(color).toBeGreaterThanOrEqual(1);
    expect(color).toBeLessThanOrEqual(6);
  });
});
