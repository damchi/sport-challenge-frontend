import {
  challengeCreateRequest,
  factorSports,
  formFieldOf,
  sortSportsByName,
} from './challengeCreate';

const SPORTS = [
  { code: 'ride', suggested_factor: 0.3 },
  { code: 'run', suggested_factor: 1 },
  { code: 'swim', suggested_factor: 1 },
  { code: 'yoga', suggested_factor: null },
  { code: 'other', suggested_factor: 1 },
];

const VALUES = {
  title: 'Défi de printemps',
  description: '',
  visibility: 'public' as const,
  members_can_invite: true,
  weeks: 6,
  start_date: '2026-10-05',
  timezone: 'America/Toronto',
  elimination_step_km: 2.5,
  factors: { ride: 0.3, swim: 1 },
};

describe('factorSports', () => {
  it('keeps the distance sports but the run', () => {
    expect(factorSports(SPORTS).map(({ code }) => code)).toEqual(['ride', 'swim', 'other']);
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
  it('sends X in meters and no factor when none changed', () => {
    expect(challengeCreateRequest(VALUES, SPORTS)).toEqual({
      title: 'Défi de printemps',
      description: '',
      visibility: 'public',
      members_can_invite: true,
      timezone: 'America/Toronto',
      start_date: '2026-10-05',
      weeks: 6,
      elimination_step_meters: 2500,
    });
  });

  it('sends only the factors the creator changed', () => {
    const request = challengeCreateRequest(
      { ...VALUES, factors: { ride: 0.25, swim: 1, other: 0.5, run: 2 } },
      SPORTS,
    );
    // Never the run: the contract refuses it, even at 1.
    expect(request.distance_factors).toEqual({ ride: 0.25, other: 0.5 });
  });

  it('rounds X to the meter', () => {
    expect(
      challengeCreateRequest({ ...VALUES, elimination_step_km: 0.1 + 0.2 }, SPORTS)
        .elimination_step_meters,
    ).toBe(300);
  });
});

describe('formFieldOf', () => {
  it.each([
    ['title', 'title'],
    ['start_date', 'start_date'],
    ['elimination_step_meters', 'elimination_step_km'],
    ['distance_factors.ride', 'factors.ride'],
    ['distance_factors', undefined],
    ['categories', undefined],
  ])('maps %s to %s', (server, form) => {
    expect(formFieldOf(server)).toBe(form);
  });
});
