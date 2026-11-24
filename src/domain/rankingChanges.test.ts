import { categoryChanges, isOut, rankingChanges, type RankedLine } from './rankingChanges';

function line(id: string, rank: number | null, extra: Partial<RankedLine> = {}): RankedLine {
  return { rank, user: { id }, abandoned: rank === null, elimination: null, ...extra };
}

describe('isOut', () => {
  it('is out once abandoned or eliminated', () => {
    expect(isOut(line('a', 1))).toBe(false);
    expect(isOut(line('a', null))).toBe(true);
    expect(isOut(line('a', 2, { elimination: { eliminated_week: 3 } }))).toBe(true);
    expect(isOut(line('a', 2, { elimination: { eliminated_week: null } }))).toBe(false);
  });
});

describe('rankingChanges', () => {
  it('says who goes up, down, stays and shares a rank, in the order after the change', () => {
    const before = [line('a', 1), line('b', 2), line('c', 3)];
    const after = [line('b', 1), line('c', 1), line('a', 3)];

    expect(rankingChanges(before, after).map(({ userId, move }) => [userId, move])).toEqual([
      ['b', { kind: 'up', places: 1 }],
      ['c', { kind: 'up', places: 2 }],
      ['a', { kind: 'down', places: 2 }],
    ]);
  });

  it('says who enters or leaves the ranking', () => {
    const before = [
      line('a', 1),
      line('b', 2, { elimination: { eliminated_week: 3 } }),
      line('c', null),
    ];
    const after = [
      line('b', 1, { elimination: { eliminated_week: null } }),
      line('d', 2),
      line('a', null),
      line('c', null),
    ];

    expect(rankingChanges(before, after).map(({ userId, move }) => [userId, move?.kind])).toEqual([
      ['b', 'in'],
      ['d', 'in'],
      ['a', 'out'],
      ['c', 'same'],
    ]);
  });

  it('keeps last the lines the ranking after the change no longer has', () => {
    const changes = rankingChanges([line('a', 1), line('b', 2)], [line('a', 1)]);

    expect(
      changes.map(({ userId, before, after, move }) => [userId, before?.rank, after, move]),
    ).toEqual([
      ['a', 1, line('a', 1), { kind: 'same' }],
      ['b', 2, null, { kind: 'out' }],
    ]);
  });

  it('gives no move without a ranking to compare with', () => {
    expect(rankingChanges(null, [line('a', 1)])).toEqual([
      { userId: 'a', before: null, after: line('a', 1), move: null },
    ]);
    expect(rankingChanges([line('a', 1)], null)).toEqual([
      { userId: 'a', before: line('a', 1), after: null, move: null },
    ]);
  });
});

describe('categoryChanges', () => {
  it('pairs the categories, those after the change first, then those it removes', () => {
    const before = [{ type: 'cumulative_time' }, { type: 'points' }];
    const after = [{ type: 'cumulative_distance' }, { type: 'cumulative_time' }];

    expect(categoryChanges(before, after)).toEqual([
      { type: 'cumulative_distance', before: null, after: { type: 'cumulative_distance' } },
      {
        type: 'cumulative_time',
        before: { type: 'cumulative_time' },
        after: { type: 'cumulative_time' },
      },
      { type: 'points', before: { type: 'points' }, after: null },
    ]);
  });

  it('takes the only side there is', () => {
    expect(categoryChanges(null, [{ type: 'points' }])).toEqual([
      { type: 'points', before: null, after: { type: 'points' } },
    ]);
    expect(categoryChanges([{ type: 'points' }], null)).toEqual([
      { type: 'points', before: { type: 'points' }, after: null },
    ]);
  });
});
