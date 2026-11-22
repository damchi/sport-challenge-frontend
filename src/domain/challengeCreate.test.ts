import {
  challengeCreateRequest,
  factorSports,
  formFieldOf,
  rebaseFactors,
  referenceSports,
  relativeFactor,
  sortSportsByName,
} from './challengeCreate';

const SPORTS = [
  { code: 'ride', distance_mode: 'required' as const, suggested_factor: 0.3 },
  { code: 'rowing', distance_mode: 'required' as const, suggested_factor: 0.5 },
  { code: 'run', distance_mode: 'required' as const, suggested_factor: 1 },
  { code: 'swim', distance_mode: 'required' as const, suggested_factor: 1 },
  { code: 'yoga', distance_mode: 'none' as const, suggested_factor: null },
  { code: 'other', distance_mode: 'optional' as const, suggested_factor: 1 },
];

const VALUES = {
  title: 'Défi de printemps',
  description: '',
  visibility: 'public' as const,
  members_can_invite: true,
  weeks: 6,
  start_date: '2026-10-05',
  timezone: 'America/Toronto',
  reference_sport: 'run',
  cumulative_distance: true,
  elimination: true,
  elimination_step_km: 2.5,
  factors: { ride: 0.3, rowing: 0.5, swim: 1 },
};

describe('referenceSports', () => {
  it('keeps the sports whose distance is required', () => {
    expect(referenceSports(SPORTS).map(({ code }) => code)).toEqual([
      'ride',
      'rowing',
      'run',
      'swim',
    ]);
  });
});

describe('relativeFactor', () => {
  it.each([
    [0.3, 1, 0.3],
    [1, 0.3, 1],
    [0.5, 0.3, 1],
    [0.3, 0.5, 0.6],
    // 0.1 / 0.3 = 0.333…
    [0.1, 0.3, 0.33],
    // 0.125 rounds half up.
    [0.125, 1, 0.13],
    [0.1, 2, 0.1],
    // A reference without a factor counts as ×1, as in the backend.
    [0.3, 0, 0.3],
  ])('brings %d back to a reference at %d: %d', (factor, reference, expected) => {
    expect(relativeFactor(factor, reference)).toBe(expected);
  });
});

describe('factorSports', () => {
  it('keeps the distance sports but the run, the default reference', () => {
    expect(factorSports(SPORTS, 'run')).toEqual([
      { code: 'ride', suggested: 0.3 },
      { code: 'rowing', suggested: 0.5 },
      { code: 'swim', suggested: 1 },
      { code: 'other', suggested: 1 },
    ]);
  });

  it('brings the suggestions back to another reference, the run coming in', () => {
    expect(factorSports(SPORTS, 'ride')).toEqual([
      { code: 'rowing', suggested: 1 },
      { code: 'run', suggested: 1 },
      { code: 'swim', suggested: 1 },
      { code: 'other', suggested: 1 },
    ]);
    expect(factorSports(SPORTS, 'rowing')).toContainEqual({ code: 'ride', suggested: 0.6 });
  });
});

describe('rebaseFactors', () => {
  it('moves the suggested factors to the new reference, the changed ones staying', () => {
    expect(
      rebaseFactors({ ride: 0.3, rowing: 0.4, swim: 1, other: 1 }, SPORTS, 'run', 'rowing'),
    ).toEqual({ ride: 0.6, run: 1 });
  });

  it('gives nothing when the factors already are the suggestions', () => {
    expect(
      rebaseFactors({ ride: 0.3, rowing: 0.5, swim: 1, other: 1 }, SPORTS, 'run', 'run'),
    ).toEqual({});
  });

  it('gives the former reference its suggestion, whatever it held before', () => {
    // Ride at 0.6 under the rowing, then reference: back to the run, it is 0.3.
    expect(
      rebaseFactors({ ride: 0.6, rowing: 1, run: 1, swim: 1, other: 1 }, SPORTS, 'ride', 'run'),
    ).toEqual({ ride: 0.3, rowing: 0.5 });
  });

  it('moves a factor set back to its former suggestion, as one never changed', () => {
    expect(rebaseFactors({ ride: 0.3 }, SPORTS, 'run', 'rowing')).toMatchObject({ ride: 0.6 });
  });

  it('gives the suggestion of a factor never set', () => {
    expect(rebaseFactors({}, SPORTS, 'run', 'ride')).toEqual({
      rowing: 1,
      run: 1,
      swim: 1,
      other: 1,
    });
  });
});

describe('sortSportsByName', () => {
  it('sorts by name in the language, the other sport last', () => {
    const names: Record<string, string> = {
      ride: 'Vélo',
      swim: 'Natation',
      other: 'Autre',
      xc_ski: 'Ski de fond',
      hike: 'Écrins',
    };
    const sorted = sortSportsByName(
      ['ride', 'other', 'swim', 'xc_ski', 'hike'].map((code) => ({ code })),
      (code) => names[code] ?? code,
      'fr',
    );
    // "É" sorts with "E", before "N", in French.
    expect(sorted.map(({ code }) => code)).toEqual(['hike', 'swim', 'xc_ski', 'ride', 'other']);
  });
});

describe('challengeCreateRequest', () => {
  const BASE = {
    title: 'Défi de printemps',
    description: '',
    visibility: 'public',
    members_can_invite: true,
    timezone: 'America/Toronto',
    start_date: '2026-10-05',
    weeks: 6,
    reference_sport: 'run',
  };

  it('sends the chosen categories, X in meters, and no factor when none changed', () => {
    expect(challengeCreateRequest(VALUES, SPORTS)).toEqual({
      ...BASE,
      categories: { cumulative_distance: {}, elimination: { step_meters: 2500 } },
    });
  });

  it('sends the cumulative time alone, without factors', () => {
    expect(
      challengeCreateRequest(
        { ...VALUES, cumulative_distance: false, elimination: false, factors: { ride: 0.25 } },
        SPORTS,
      ),
    ).toEqual(BASE);
  });

  it('sends the elimination alone, in the reference sport', () => {
    expect(
      challengeCreateRequest(
        { ...VALUES, reference_sport: 'ride', cumulative_distance: false },
        SPORTS,
      ),
    ).toEqual({
      ...BASE,
      reference_sport: 'ride',
      categories: { elimination: { step_meters: 2500 } },
    });
  });

  it('sends only the factors the creator changed', () => {
    const request = challengeCreateRequest(
      { ...VALUES, factors: { ride: 0.25, rowing: 0.5, swim: 1, other: 0.5, run: 2 } },
      SPORTS,
    );
    // Never the reference: the contract refuses it, even at 1.
    expect(request.distance_factors).toEqual({ ride: 0.25, other: 0.5 });
  });

  it('compares the factors with the suggestions of the reference chosen', () => {
    const reference = 'ride';
    const factors = { ride: 0.3, rowing: 1, run: 1, swim: 0.8, other: 1 };
    expect(
      challengeCreateRequest({ ...VALUES, reference_sport: reference, factors }, SPORTS)
        .distance_factors,
    ).toEqual({ swim: 0.8 });
  });

  it('rounds X to the meter', () => {
    expect(
      challengeCreateRequest({ ...VALUES, elimination_step_km: 0.1 + 0.2 }, SPORTS).categories
        ?.elimination?.step_meters,
    ).toBe(300);
  });
});

describe('formFieldOf', () => {
  it.each([
    ['title', 'title'],
    ['start_date', 'start_date'],
    ['categories.elimination.step_meters', 'elimination_step_km'],
    ['distance_factors.ride', 'factors.ride'],
    ['distance_factors', 'factors'],
    ['reference_sport', 'reference_sport'],
    ['categories', undefined],
  ])('maps %s to %s', (server, form) => {
    expect(formFieldOf(server)).toBe(form);
  });
});
