import {
  changedSettings,
  settingsFormValues,
  settingsUpdate,
  type ChallengeSettings,
} from './adminChallengeSettings';
import type { CatalogueSport } from './challengeCreate';
import {
  challengeCreateSchema,
  type ChallengeCreateInput,
  type ChallengeCreateValues,
} from './schemas/challenge';

const sports: CatalogueSport[] = [
  { code: 'run', distance_mode: 'required', suggested_factor: 1 },
  { code: 'ride', distance_mode: 'required', suggested_factor: 0.3 },
  { code: 'rowing', distance_mode: 'required', suggested_factor: 0.5 },
  { code: 'yoga', distance_mode: 'none', suggested_factor: null },
  {
    code: 'crossfit',
    distance_mode: 'none',
    suggested_factor: null,
    exercises: ['burpee', 'wall_ball'],
  },
];

const challenge: ChallengeSettings = {
  title: 'Défi d’automne',
  description: null,
  visibility: 'private',
  members_can_invite: true,
  timezone: 'America/Toronto',
  reference_sport: 'run',
  // Midnight in Montréal, on Monday 2 November 2026.
  starts_at: '2026-11-02T05:00:00Z',
  weeks: [1, 2, 3, 4],
  categories: [
    { type: 'cumulative_time', params: {} },
    { type: 'cumulative_distance', params: { factors: { run: 1, ride: 0.25, rowing: 0.5 } } },
    { type: 'elimination', params: { step_meters: 3000 } },
    {
      type: 'points',
      params: {
        criteria: ['longest_duration', 'session_count'],
        podium: 5,
        min_session_seconds: 1800,
      },
    },
  ],
};

const initial = settingsFormValues(challenge);

/** The form's values once checked, as an admin's form gives them. */
function checked(values: ChallengeCreateInput): ChallengeCreateValues {
  return challengeCreateSchema(new Date('2026-11-24T12:00:00Z'), {
    pastStart: true,
    withoutDistance: ['yoga', 'crossfit'],
  }).parse(values);
}

// A CrossFit challenge, eliminated on the wall balls (X = 10).
const crossfit = settingsFormValues({
  ...challenge,
  reference_sport: 'crossfit',
  categories: [
    { type: 'cumulative_time', params: {} },
    { type: 'elimination', params: { exercise: 'wall_ball', step_repetitions: 10 } },
  ],
});

describe('the elimination by repetitions', () => {
  it('fills its exercise and X in repetitions', () => {
    expect(crossfit).toMatchObject({
      elimination: true,
      elimination_exercise: 'wall_ball',
      elimination_step_repetitions: 10,
    });
  });

  it('names and sends a new exercise and a new X', () => {
    const values = {
      ...crossfit,
      elimination_exercise: 'burpee',
      elimination_step_repetitions: 20,
    };

    expect(changedSettings(crossfit, values, sports)).toEqual([
      'elimination_exercise',
      'elimination_step_repetitions',
    ]);
    expect(settingsUpdate(crossfit, checked(values), sports)).toEqual({
      categories: { elimination: { exercise: 'burpee', step_repetitions: 20 } },
    });
  });

  it('leaves the categories alone while they stay the same', () => {
    expect(settingsUpdate(crossfit, checked(crossfit), sports)).toEqual({});
  });

  it('sends a reference sport without distance with the categories it keeps', () => {
    const values = {
      ...initial,
      reference_sport: 'crossfit',
      cumulative_distance: false,
      elimination: false,
      points_criteria: ['session_count' as const],
    };

    expect(settingsUpdate(initial, checked(values), sports)).toEqual({
      reference_sport: 'crossfit',
      categories: { points: { criteria: ['session_count'], podium: 5, min_session_minutes: 30 } },
    });
  });
});

describe('settingsFormValues', () => {
  it('fills the form with the settings of the challenge', () => {
    expect(initial).toEqual({
      title: 'Défi d’automne',
      description: '',
      visibility: 'private',
      members_can_invite: true,
      weeks: 4,
      start_date: '2026-11-02',
      timezone: 'America/Toronto',
      reference_sport: 'run',
      cumulative_distance: true,
      elimination: true,
      elimination_step_km: 3,
      elimination_exercise: '',
      points: true,
      points_criteria: ['longest_duration', 'session_count'],
      points_podium: '5',
      points_min_session_minutes: 30,
      cumulative_elevation: false,
      // The reference counts ×1: it has no field.
      factors: { ride: 0.25, rowing: 0.5 },
    });
  });

  it('gives the defaults of a challenge with the cumulative time alone', () => {
    const values = settingsFormValues({
      ...challenge,
      categories: [{ type: 'cumulative_time', params: {} }],
    });

    expect(values).toMatchObject({
      cumulative_distance: false,
      elimination: false,
      elimination_step_km: undefined,
      points: false,
      points_criteria: [],
      points_podium: null,
      points_min_session_minutes: 20,
      factors: {},
    });
  });

  it('takes the factors of the points when the cumulative distance is off', () => {
    const values = settingsFormValues({
      ...challenge,
      categories: [
        {
          type: 'points',
          params: { criteria: ['longest_distance'], podium: 10, factors: { run: 1, ride: 0.4 } },
        },
      ],
    });

    expect(values.factors).toEqual({ ride: 0.4 });
    expect(values.points_podium).toBe('10');
  });
});

describe('changedSettings', () => {
  it('names nothing while the form keeps the settings', () => {
    expect(changedSettings(initial, { ...initial }, sports)).toEqual([]);
  });

  it('names each setting that changes, in the form order', () => {
    const values: ChallengeCreateInput = {
      ...initial,
      title: '  Défi d’hiver ',
      weeks: 6,
      elimination_step_km: 2,
      points_podium: '10',
      cumulative_elevation: true,
      factors: { ride: 0.3, rowing: 0.5 },
    };

    expect(changedSettings(initial, values, sports)).toEqual([
      'title',
      'weeks',
      'elimination_step_km',
      'points_podium',
      'cumulative_elevation',
      'factors.ride',
    ]);
  });

  it('ignores the trimmed spaces of the title and the order of the criteria', () => {
    const values = {
      ...initial,
      title: ' Défi d’automne ',
      points_criteria: ['session_count' as const, 'longest_duration' as const],
    };

    expect(changedSettings(initial, values, sports)).toEqual([]);
  });

  it('names a category switched off, not its settings', () => {
    const values = { ...initial, elimination: false, elimination_step_km: 5 };

    expect(changedSettings(initial, values, sports)).toEqual(['elimination']);
  });

  it('names an emptied number, which the form holds as NaN', () => {
    const values = { ...initial, weeks: Number.NaN };

    expect(changedSettings(initial, values, sports)).toEqual(['weeks']);
  });

  it('reads the factors against the suggestion when the challenge had none', () => {
    const timeOnly = settingsFormValues({
      ...challenge,
      categories: [{ type: 'cumulative_time', params: {} }],
    });
    const values = { ...timeOnly, cumulative_distance: true, factors: { ride: 0.3, rowing: 0.4 } };

    expect(changedSettings(timeOnly, values, sports)).toEqual([
      'cumulative_distance',
      'factors.rowing',
    ]);
  });
});

describe('settingsUpdate', () => {
  it('sends nothing when nothing changes', () => {
    expect(settingsUpdate(initial, checked(initial), sports)).toEqual({});
  });

  it('sends only the fields that change, the title trimmed', () => {
    const values = checked({
      ...initial,
      title: ' Défi d’hiver ',
      visibility: 'public',
      start_date: '2026-10-26',
    });

    expect(settingsUpdate(initial, values, sports)).toEqual({
      title: 'Défi d’hiver',
      visibility: 'public',
      start_date: '2026-10-26',
    });
  });

  it('sends a new time zone alone: the first day stays the same local day', () => {
    const values = checked({ ...initial, timezone: 'Europe/Paris' });

    expect(settingsUpdate(initial, values, sports)).toEqual({ timezone: 'Europe/Paris' });
  });

  it('sends the categories as a whole once one setting changes', () => {
    const values = checked({ ...initial, elimination_step_km: 2 });

    expect(settingsUpdate(initial, values, sports)).toEqual({
      categories: {
        cumulative_distance: {},
        elimination: { step_meters: 2000 },
        points: {
          criteria: ['longest_duration', 'session_count'],
          podium: 5,
          min_session_minutes: 30,
        },
      },
    });
  });

  it('sends empty categories when only the cumulative time stays', () => {
    const values = checked({
      ...initial,
      cumulative_distance: false,
      elimination: false,
      points: false,
    });

    expect(settingsUpdate(initial, values, sports)).toEqual({ categories: {} });
  });

  it('sends the factors that differ from those of the challenge', () => {
    const values = checked({ ...initial, factors: { ride: 0.25, rowing: 0.7 } });

    expect(settingsUpdate(initial, values, sports)).toEqual({ distance_factors: { rowing: 0.7 } });
  });

  it('with a new reference, sends the factors that differ from its suggestions', () => {
    // Brought back to the ride (0.3): the run 1, the rowing 1 (at most 1).
    const values = checked({
      ...initial,
      reference_sport: 'ride',
      factors: { run: 1, rowing: 0.8 },
    });

    expect(settingsUpdate(initial, values, sports)).toEqual({
      reference_sport: 'ride',
      distance_factors: { rowing: 0.8 },
    });
  });

  it('sends no factor when no category uses them', () => {
    const values = checked({
      ...initial,
      cumulative_distance: false,
      factors: { ride: 0.9, rowing: 0.5 },
    });

    expect(settingsUpdate(initial, values, sports)).not.toHaveProperty('distance_factors');
  });
});

describe('the start date of an admin', () => {
  const schema = challengeCreateSchema(new Date('2026-11-24T12:00:00Z'), { pastStart: true });

  it('may be in the past', () => {
    expect(schema.safeParse({ ...initial, start_date: '2025-01-06' }).success).toBe(true);
  });

  it('is at most a year ahead', () => {
    const result = schema.safeParse({ ...initial, start_date: '2027-11-25' });

    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      'challengeCreate.fields.startDate.rangeAdmin',
    ]);
  });
});
