import { formatRank, sharedRanks } from './rank';

describe('formatRank', () => {
  it('writes French ordinals', () => {
    expect(formatRank(1, 'fr')).toBe('1er');
    expect(formatRank(2, 'fr')).toBe('2e');
    expect(formatRank(21, 'fr-CA')).toBe('21e');
  });

  it('writes English ordinals', () => {
    expect(formatRank(1, 'en')).toBe('1st');
    expect(formatRank(2, 'en')).toBe('2nd');
    expect(formatRank(3, 'en')).toBe('3rd');
    expect(formatRank(11, 'en')).toBe('11th');
    expect(formatRank(13, 'en')).toBe('13th');
    expect(formatRank(22, 'en')).toBe('22nd');
  });
});

describe('sharedRanks', () => {
  it('finds the ranks of ties', () => {
    expect(sharedRanks([1, 1, 3, 4, 4, 6])).toEqual(new Set([1, 4]));
  });

  it('ignores the participants without a rank', () => {
    expect(sharedRanks([1, 2, null, null])).toEqual(new Set());
  });
});
