import { eliminationLine, type Progress } from './eliminationWeek';

const progress = (overrides: Partial<Progress>): Progress => ({
  status: null,
  eliminated_week: null,
  minimum_meters: null,
  distance_meters: 0,
  week_ends_at: '2026-11-28T05:00:00Z',
  ...overrides,
});

describe('eliminationLine', () => {
  it('says the week of the elimination once eliminated', () => {
    expect(
      eliminationLine(progress({ status: 'eliminated', eliminated_week: 3, week_ends_at: null })),
    ).toEqual({ kind: 'eliminated', week: 3 });
  });

  it('gives a survivor its week against the minimum, the bar capped at 1', () => {
    expect(
      eliminationLine(
        progress({ status: 'at_risk', minimum_meters: 25_000, distance_meters: 18_000 }),
      ),
    ).toMatchObject({ kind: 'live', unit: 'meters', done: 18_000, minimum: 25_000, share: 0.72 });
    expect(
      eliminationLine(
        progress({ status: 'reached', minimum_meters: 10_000, distance_meters: 12_000 }),
      ),
    ).toMatchObject({ kind: 'live', share: 1 });
  });

  it('gives the distance of the week alone without a minimum (week 1)', () => {
    expect(eliminationLine(progress({ distance_meters: 12_000 }))).toEqual({
      kind: 'distance',
      unit: 'meters',
      done: 12_000,
    });
  });

  it('counts in repetitions when the server gives them', () => {
    const reps = { status: 'at_risk' as const, repetitions: 30, minimum_repetitions: 40 };
    expect(eliminationLine(progress(reps))).toMatchObject({ unit: 'repetitions', done: 30 });
    expect(eliminationLine(progress(reps))).toMatchObject({ minimum: 40, share: 0.75 });
  });
});
