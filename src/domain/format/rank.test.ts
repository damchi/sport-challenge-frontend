import { sharedRanks } from './rank';

describe('sharedRanks', () => {
  it('finds the ranks of ties', () => {
    expect(sharedRanks([1, 1, 3, 4, 4, 6])).toEqual(new Set([1, 4]));
  });

  it('ignores the participants without a rank', () => {
    expect(sharedRanks([1, 2, null, null])).toEqual(new Set());
  });
});
