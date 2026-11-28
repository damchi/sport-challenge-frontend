import {
  activityTimeZone,
  holdsEntry,
  isActivityId,
  isSportCode,
  keptSport,
  offeredExercises,
  sortSportsForEntry,
  type ExerciseChallenge,
} from './activity';

describe('activityTimeZone', () => {
  it("takes the device's time zone without an ongoing challenge", () => {
    expect(activityTimeZone([], 'Europe/Paris')).toBe('Europe/Paris');
  });

  it('takes the time zone the challenges where the user takes part share', () => {
    expect(
      activityTimeZone(
        [
          { timezone: 'America/Toronto', my_status: 'active' },
          { timezone: 'America/Vancouver', my_status: 'abandoned' },
          { timezone: 'Asia/Tokyo', my_status: null },
          { timezone: 'America/Toronto', my_status: 'active' },
        ],
        'Europe/Paris',
      ),
    ).toBe('America/Toronto');
  });

  it("takes the device's when those challenges are in several time zones", () => {
    expect(
      activityTimeZone(
        [
          { timezone: 'America/Toronto', my_status: 'active' },
          { timezone: 'Europe/Paris', my_status: 'active' },
        ],
        'Asia/Tokyo',
      ),
    ).toBe('Asia/Tokyo');
  });

  it("takes the device's when the user takes part in none of them", () => {
    expect(
      activityTimeZone([{ timezone: 'America/Toronto', my_status: 'abandoned' }], 'Europe/Paris'),
    ).toBe('Europe/Paris');
  });
});

describe('offeredExercises', () => {
  // Two CrossFit challenges on burpees and one on wall balls, in November.
  const challenge = (exercise: string | null, more: Partial<ExerciseChallenge> = {}) => ({
    reference_sport: 'crossfit',
    exercise,
    starts_at: '2026-11-02T05:00:00Z',
    ends_at: '2026-11-30T05:00:00Z',
    my_status: 'active' as const,
    ...more,
  });
  const start = new Date('2026-11-20T12:00:00Z');

  it('offers each exercise once, in the order of the challenges', () => {
    const challenges = [challenge('burpee'), challenge('wall_ball'), challenge('burpee')];
    expect(offeredExercises(challenges, 'crossfit', start)).toEqual(['burpee', 'wall_ball']);
  });

  it.each([
    ['another sport', challenge('burpee', { reference_sport: 'yoga' })],
    ['an elimination in km', challenge(null)],
    ['an abandoned challenge', challenge('burpee', { my_status: 'abandoned' })],
    ['a challenge not joined', challenge('burpee', { my_status: null })],
    ['a start before the window', challenge('burpee', { starts_at: '2026-11-21T05:00:00Z' })],
    ['a start at its end', challenge('burpee', { ends_at: '2026-11-20T12:00:00Z' })],
  ])('offers nothing for %s', (_, offering) => {
    expect(offeredExercises([offering], 'crossfit', start)).toEqual([]);
  });

  it('offers an exercise from the very start of its window', () => {
    const opening = challenge('burpee', { starts_at: '2026-11-20T12:00:00Z' });
    expect(offeredExercises([opening], 'crossfit', start)).toEqual(['burpee']);
  });
});

describe('isSportCode', () => {
  it('accepts a code of the catalogue shape and nothing else', () => {
    expect(isSportCode('run')).toBe(true);
    expect(isSportCode('trail_run2')).toBe(true);
    expect(isSportCode('Run')).toBe(false);
    expect(isSportCode('run&x=1')).toBe(false);
    expect(isSportCode('a'.repeat(33))).toBe(false);
    expect(isSportCode(null)).toBe(false);
  });
});

describe('keptSport', () => {
  const sports = [{ sport_code: 'run' }, { sport_code: 'yoga' }];

  it('keeps a sport the user has activities of, or not yet known', () => {
    expect(keptSport('run', sports)).toBe('run');
    expect(keptSport('ride', undefined)).toBe('ride');
  });

  it('lets go of a sport without activity, or not a sport code', () => {
    expect(keptSport('ride', sports)).toBeUndefined();
    expect(keptSport('Run', sports)).toBeUndefined();
    expect(keptSport(null, sports)).toBeUndefined();
  });
});

describe('isActivityId', () => {
  it('accepts a UUID and nothing else', () => {
    expect(isActivityId('00000000-0000-4000-8000-0000000000A1')).toBe(true);
    expect(isActivityId('new')).toBe(false);
    expect(isActivityId('00000000-0000-4000-8000-0000000000a1/x')).toBe(false);
    expect(isActivityId(undefined)).toBe(false);
  });
});

describe('sortSportsForEntry', () => {
  const names: Record<string, string> = { padel: 'Padel', archery: 'Tir à l’arc' };
  const name = (code: string) => names[code] ?? code;
  const codes = (list: string[]) =>
    sortSportsForEntry(
      list.map((code) => ({ code })),
      name,
      'fr',
    ).map(({ code }) => code);

  it("offers the mockups' order, whatever the catalogue's", () => {
    expect(
      codes([
        'yoga',
        'other',
        'climbing',
        'hike',
        'ride',
        'roller',
        'rowing',
        'run',
        'strength',
        'swim',
        'walk',
        'xc_ski',
      ]),
    ).toEqual([
      'run',
      'ride',
      'walk',
      'hike',
      'swim',
      'rowing',
      'roller',
      'xc_ski',
      'yoga',
      'climbing',
      'strength',
      'other',
    ]);
  });

  it('puts the sports it does not know after them, by name, "other" last', () => {
    expect(codes(['other', 'padel', 'run', 'archery'])).toEqual([
      'run',
      'padel',
      'archery',
      'other',
    ]);
  });
});

describe('holdsEntry', () => {
  const entry = { sport_code: 'run', started_at: '2026-11-20T12:30:00.000Z', duration_seconds: 60 };
  const recorded = { ...entry, started_at: '2026-11-20T12:30:00Z', distance_meters: null };

  it.each([
    [{}, true],
    [{ sport_code: 'ride' }, false],
    [{ sport_label: 'Padel' }, false],
    [{ started_at: '2026-11-20T12:31:00Z' }, false],
    [{ duration_seconds: 61 }, false],
    [{ distance_meters: 8200 }, false],
    [{ elevation_gain_meters: 85 }, false],
  ])('compares the activity recorded, changed by %o, with the entry', (change, same) => {
    expect(holdsEntry({ ...recorded, ...change }, entry)).toBe(same);
  });

  it('compares the repetitions by exercise, in any order', () => {
    const burpees = { exercise: 'burpee', repetitions: 120 };
    const squats = { exercise: 'air_squat', repetitions: 50 };
    const sent = { ...entry, repetitions: [burpees, squats] };
    expect(holdsEntry({ ...recorded, repetitions: [squats, burpees] }, sent)).toBe(true);
    expect(holdsEntry(recorded, sent)).toBe(false);
    expect(
      holdsEntry({ ...recorded, repetitions: [{ ...squats, repetitions: 5 }, burpees] }, sent),
    ).toBe(false);
  });
});
