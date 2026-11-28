import {
  activityCreateSchema,
  activityDraft,
  activityFormFieldOf,
  activityFormValues,
  cleanSportLabel,
  clockTime,
  takesElevation,
  type ActivityCreateInput,
  type ActivitySport,
} from './activity';

const sports: ActivitySport[] = [
  { code: 'run', distance_mode: 'required', elevation_allowed: true },
  { code: 'swim', distance_mode: 'required', elevation_allowed: false },
  { code: 'yoga', distance_mode: 'none', elevation_allowed: false },
  { code: 'other', distance_mode: 'optional', elevation_allowed: true },
];

// Friday 20 November 2026, noon in Montréal.
const now = new Date('2026-11-20T17:00:00Z');
// 7:30 in Montréal.
const STARTED_AT = '2026-11-20T12:30:00.000Z';
const schema = activityCreateSchema(() => now, sports, 'America/Toronto');

const valid: ActivityCreateInput = {
  sport_code: 'run',
  sport_label: '',
  start_date: '2026-11-20',
  start_hour: '07',
  start_minute: '30',
  hours: '1',
  minutes: '02',
  seconds: '3',
  distance_km: '12,5',
  elevation_m: '',
  repetitions: {},
};

function errorsOf(input: Partial<ActivityCreateInput>): Record<string, string> {
  const result = schema.safeParse({ ...valid, ...input });
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
  );
}

describe('activityCreateSchema, repetitions', () => {
  // A CrossFit entry whose start takes burpees and wall balls.
  const offered = (sportCode: string, start: Date) =>
    sportCode === 'crossfit' && start.toISOString() === STARTED_AT ? ['burpee', 'wall_ball'] : [];
  const crossfit = activityCreateSchema(
    () => now,
    [...sports, { code: 'crossfit', distance_mode: 'none', elevation_allowed: false }],
    'America/Toronto',
    offered,
  );
  const entry = (repetitions: Record<string, string>, more: Partial<ActivityCreateInput> = {}) => ({
    ...valid,
    sport_code: 'crossfit',
    distance_km: '',
    repetitions,
    ...more,
  });

  it('sends the repetitions typed, for the exercises offered only', () => {
    expect(
      crossfit.parse(entry({ burpee: ' 120 ', wall_ball: '', box_jump: '30' })).repetitions,
    ).toEqual([{ exercise: 'burpee', repetitions: 120 }]);
  });

  it('sends no repetitions without any typed', () => {
    expect(crossfit.parse(entry({ burpee: '', wall_ball: ' ' }))).not.toHaveProperty('repetitions');
  });

  it('takes 0 to 10 000 repetitions', () => {
    expect(crossfit.parse(entry({ burpee: '0', wall_ball: '10000' })).repetitions).toEqual([
      { exercise: 'burpee', repetitions: 0 },
      { exercise: 'wall_ball', repetitions: 10_000 },
    ]);
  });

  it.each(['10001', '-1', '12,5', 'dix'])('refuses %s repetitions on their exercise', (typed) => {
    const result = crossfit.safeParse(entry({ wall_ball: typed }));
    expect(result.error?.issues.map(({ path, message }) => [path, message])).toEqual([
      [['repetitions', 'wall_ball'], 'activityForm.fields.repetitions.range'],
    ]);
  });

  it('neither checks nor sends the repetitions of an exercise no longer offered', () => {
    // Another day: the start takes no exercise any more.
    const moved = entry({ burpee: 'dix' }, { start_date: '2026-11-19' });
    expect(crossfit.parse(moved)).not.toHaveProperty('repetitions');
  });

  it('keeps an exercise already on the activity, whatever its sport or start now', () => {
    const changed = activityCreateSchema(() => now, sports, 'America/Toronto', offered, [
      'push_up',
    ]);
    const moved = entry({ push_up: '40', burpee: '9' }, { sport_code: 'run', distance_km: '5' });
    expect(changed.parse(moved).repetitions).toEqual([{ exercise: 'push_up', repetitions: 40 }]);
    expect(changed.parse({ ...moved, repetitions: { push_up: '' } })).not.toHaveProperty(
      'repetitions',
    );
  });

  it('puts the repetitions the server refuses on the repetitions', () => {
    expect(activityFormFieldOf('repetitions')).toBe('root.repetitions');
  });
});

describe('activityCreateSchema', () => {
  it('gives the request: start in UTC, duration in seconds, distance in meters', () => {
    expect(schema.parse(valid)).toEqual({
      sport_code: 'run',
      started_at: STARTED_AT,
      duration_seconds: 3723,
      distance_meters: 12_500,
    });
  });

  it('wants a sport of the catalogue', () => {
    expect(errorsOf({ sport_code: '' })).toEqual({
      sport_code: 'activityForm.fields.sport.required',
    });
    expect(errorsOf({ sport_code: 'darts' }).sport_code).toBe('activityForm.fields.sport.required');
  });

  describe('the "other" sport', () => {
    const other = { sport_code: 'other', distance_km: '' };

    it('sends its label, spaces cleaned, and no distance when none is given', () => {
      expect(schema.parse({ ...valid, ...other, sport_label: '  Pétanque   en  duo ' })).toEqual({
        sport_code: 'other',
        sport_label: 'Pétanque en duo',
        started_at: STARTED_AT,
        duration_seconds: 3723,
      });
    });

    it('takes a distance when one is given', () => {
      expect(schema.parse({ ...valid, ...other, sport_label: 'Kayak', distance_km: '3' })).toEqual(
        expect.objectContaining({ distance_meters: 3000 }),
      );
    });

    it.each([
      ['', 'activityForm.fields.sportLabel.length'],
      ['a', 'activityForm.fields.sportLabel.length'],
      ['x'.repeat(41), 'activityForm.fields.sportLabel.length'],
      ['ab​', 'activityForm.fields.sportLabel.characters'],
    ])('refuses the label %j', (label, message) => {
      expect(errorsOf({ ...other, sport_label: label }).sport_label).toBe(message);
    });

    it('accepts 2 and 40 characters', () => {
      expect(errorsOf({ ...other, sport_label: 'ab' })).toEqual({});
      expect(errorsOf({ ...other, sport_label: 'x'.repeat(40) })).toEqual({});
      // Counted in characters, as the server does, not UTF-16 units.
      expect(errorsOf({ ...other, sport_label: '🏄'.repeat(40) })).toEqual({});
      expect(errorsOf({ ...other, sport_label: '🏄'.repeat(41) }).sport_label).toBe(
        'activityForm.fields.sportLabel.length',
      );
    });
  });

  it('ignores the label of another sport', () => {
    expect(schema.parse({ ...valid, sport_label: 'Kayak' })).not.toHaveProperty('sport_label');
  });

  describe('start', () => {
    it('is read in the given time zone', () => {
      const paris = activityCreateSchema(() => now, sports, 'Europe/Paris');
      expect(paris.parse(valid).started_at).toBe('2026-11-20T06:30:00.000Z');
    });

    it.each([
      ['', '7', '30'],
      ['2026-11-20', '', ''],
      ['2026-11-20', ' ', '30'],
      ['yesterday', '7', '30'],
    ])('wants a date and an hour, not %j at %j h %j', (date, hour, minute) => {
      // The one error goes on the day.
      expect(errorsOf({ start_date: date, start_hour: hour, start_minute: minute })).toEqual({
        start_date: 'activityForm.fields.startedAt.required',
      });
    });

    it.each([
      ['24', ''],
      ['7', '60'],
      ['7h', ''],
      ['', 'ab'],
      ['123', ''],
      ['7', '300'],
    ])('wants an hour and minutes on 24 hours, not %j h %j', (hour, minute) => {
      expect(errorsOf({ start_hour: hour, start_minute: minute })).toEqual({
        start_date: 'activityForm.fields.startedAt.timeFormat',
      });
    });

    it('takes the hour alone, with or without its zero', () => {
      const at8 = '2026-11-20T13:00:00.000Z';
      expect(schema.parse({ ...valid, start_hour: '8', start_minute: '' }).started_at).toBe(at8);
      expect(schema.parse({ ...valid, start_hour: '08', start_minute: '' }).started_at).toBe(at8);
      expect(schema.parse({ ...valid, start_hour: ' 7 ', start_minute: '30' }).started_at).toBe(
        STARTED_AT,
      );
    });

    it('is never in the future nor before 2000', () => {
      expect(errorsOf({ start_hour: '12', start_minute: '01' }).start_date).toBe(
        'activityForm.fields.startedAt.range',
      );
      // 2000-01-01 is in UTC: a day earlier is before it in any time zone.
      expect(
        errorsOf({ start_date: '1999-12-30', start_hour: '23', start_minute: '59' }).start_date,
      ).toBe('activityForm.fields.startedAt.range');
    });

    it('reads the current instant at each check', () => {
      let current = new Date('2026-11-20T12:00:00Z');
      const live = activityCreateSchema(() => current, sports, 'America/Toronto');
      expect(live.safeParse(valid).success).toBe(false);
      current = new Date('2026-11-20T14:00:00Z');
      expect(live.safeParse(valid).success).toBe(true);
    });
  });

  describe('duration', () => {
    it('counts an empty part as 0', () => {
      expect(schema.parse({ ...valid, hours: '', seconds: '' }).duration_seconds).toBe(120);
    });

    it.each([[{ hours: '1.5' }], [{ minutes: '60' }], [{ seconds: '-1' }], [{ hours: '25' }]])(
      'wants whole hours, minutes and seconds under 60 (%j)',
      (parts) => {
        expect(errorsOf(parts).hours).toBe('activityForm.fields.duration.invalid');
      },
    );

    it('is always required, 24 hours at most', () => {
      expect(errorsOf({ hours: '', minutes: '', seconds: '' }).hours).toBe(
        'activityForm.fields.duration.range',
      );
      expect(errorsOf({ hours: '24', minutes: '0', seconds: '1' }).hours).toBe(
        'activityForm.fields.duration.range',
      );
    });

    it('ends by now, give or take 5 minutes', () => {
      // 11:00 plus 1 h 5 min ends at 12:05: still accepted.
      expect(
        errorsOf({ start_hour: '11', start_minute: '', hours: '1', minutes: '5', seconds: '' }),
      ).toEqual({});
      expect(
        errorsOf({ start_hour: '11', start_minute: '', hours: '1', minutes: '5', seconds: '1' })
          .hours,
      ).toBe('activityForm.fields.duration.future');
    });
  });

  describe('distance', () => {
    it.each(['', '  '])('is required for a sport with km (%j)', (distance) => {
      expect(errorsOf({ distance_km: distance }).distance_km).toBe(
        'activityForm.fields.distance.required',
      );
    });

    it.each(['0', '12.3456', 'abc', '1000.001', '-3'])('refuses %j km', (distance) => {
      expect(errorsOf({ distance_km: distance }).distance_km).toBe(
        'activityForm.fields.distance.range',
      );
    });

    it('takes a point or a comma, to the meter', () => {
      expect(schema.parse({ ...valid, distance_km: '8.215' }).distance_meters).toBe(8215);
      expect(schema.parse({ ...valid, distance_km: '1000' }).distance_meters).toBe(1_000_000);
    });

    it('is never sent for a sport without km', () => {
      expect(schema.parse({ ...valid, sport_code: 'yoga', distance_km: '5' })).not.toHaveProperty(
        'distance_meters',
      );
    });
  });
});

describe('elevation gain', () => {
  it('is sent in meters when typed, and left out when empty', () => {
    expect(schema.parse({ ...valid, elevation_m: ' 85 ' }).elevation_gain_meters).toBe(85);
    expect(schema.parse({ ...valid, elevation_m: '0' }).elevation_gain_meters).toBe(0);
    expect(schema.parse({ ...valid, elevation_m: '20000' }).elevation_gain_meters).toBe(20_000);
    expect(schema.parse(valid)).not.toHaveProperty('elevation_gain_meters');
  });

  it.each(['-1', '12.5', '12,5', 'abc', '20001'])('refuses %j m', (elevation) => {
    expect(errorsOf({ elevation_m: elevation })).toEqual({
      elevation_m: 'activityForm.fields.elevation.range',
    });
  });

  it.each([
    ['a sport that takes none', { sport_code: 'swim' }],
    [
      'an activity without distance',
      { sport_code: 'other', sport_label: 'Kayak', distance_km: '' },
    ],
  ])('is neither checked nor sent for %s', (_, input) => {
    expect(errorsOf({ ...input, elevation_m: 'abc' })).toEqual({});
    expect(schema.parse({ ...valid, ...input, elevation_m: '85' })).not.toHaveProperty(
      'elevation_gain_meters',
    );
  });

  it('goes with the distance of the "other" sport', () => {
    const kayak = {
      sport_code: 'other',
      sport_label: 'Kayak',
      distance_km: '3',
      elevation_m: '12',
    };
    expect(schema.parse({ ...valid, ...kayak }).elevation_gain_meters).toBe(12);
  });
});

describe('takesElevation', () => {
  const run = { code: 'run', distance_mode: 'required', elevation_allowed: true } as const;

  it('wants a sport that allows it and a distance typed', () => {
    expect(takesElevation(run, '5')).toBe(true);
    expect(takesElevation(run, ' ')).toBe(false);
    expect(takesElevation({ ...run, elevation_allowed: false }, '5')).toBe(false);
    expect(takesElevation(undefined, '5')).toBe(false);
    expect(takesElevation({ ...run, distance_mode: 'none' }, '5')).toBe(false);
  });
});

describe('clockTime', () => {
  it.each([
    ['8', '', '08:00'],
    ['08', '', '08:00'],
    ['7', '30', '07:30'],
    ['7', '3', '07:03'],
    [' 23 ', ' 59 ', '23:59'],
    ['0', '0', '00:00'],
  ])('writes %j h %j as %j', (hour, minute, written) => {
    expect(clockTime(hour, minute)).toBe(written);
  });

  it.each([
    ['', ''],
    ['', '30'],
    ['24', ''],
    ['7', '60'],
    ['7h', ''],
    ['-1', ''],
    ['123', ''],
    ['7', '1.5'],
  ])('reads no time in %j h %j', (hour, minute) => {
    expect(clockTime(hour, minute)).toBeUndefined();
  });
});

describe('cleanSportLabel', () => {
  it('collapses and trims the spaces', () => {
    expect(cleanSportLabel(' a   b\t')).toBe('a b');
  });
});

describe('activityFormFieldOf', () => {
  it('gives the form field of a refused request field', () => {
    expect(activityFormFieldOf('duration_seconds')).toBe('hours');
    expect(activityFormFieldOf('distance_meters')).toBe('distance_km');
    expect(activityFormFieldOf('started_at')).toBe('start_date');
    expect(activityFormFieldOf('elevation_gain_meters')).toBe('elevation_m');
    expect(activityFormFieldOf('constructor')).toBeUndefined();
  });
});

describe('activityFormValues', () => {
  it('gives the form an activity as entered, in the time zone and the language', () => {
    const values = activityFormValues(
      {
        sport_code: 'run',
        sport_label: null,
        started_at: STARTED_AT,
        duration_seconds: 3723,
        distance_meters: 12_500,
        elevation_gain_meters: 85,
      },
      'America/Toronto',
      'fr',
    );

    expect(values).toEqual({ ...valid, minutes: '2', elevation_m: '85' });
    // Sent again, it gives the same activity.
    expect(schema.parse(values)).toEqual({
      sport_code: 'run',
      started_at: STARTED_AT,
      duration_seconds: 3723,
      distance_meters: 12_500,
      elevation_gain_meters: 85,
    });
  });

  it('leaves empty what the activity lacks', () => {
    expect(
      activityFormValues(
        {
          sport_code: 'other',
          sport_label: 'Padel',
          started_at: STARTED_AT,
          duration_seconds: 3600,
          distance_meters: null,
          elevation_gain_meters: null,
        },
        'America/Toronto',
        'en',
      ),
    ).toEqual({
      sport_code: 'other',
      sport_label: 'Padel',
      start_date: '2026-11-20',
      start_hour: '07',
      start_minute: '30',
      hours: '1',
      minutes: '',
      seconds: '',
      distance_km: '',
      elevation_m: '',
      repetitions: {},
    });
  });

  it('writes the distance with the decimal point of the language', () => {
    const run = {
      sport_code: 'run',
      sport_label: null,
      started_at: STARTED_AT,
      duration_seconds: 60,
      distance_meters: 1_234_567,
      elevation_gain_meters: null,
    };
    expect(activityFormValues(run, 'America/Toronto', 'en').distance_km).toBe('1234.567');
    expect(activityFormValues(run, 'America/Toronto', 'fr').distance_km).toBe('1234,567');
  });
});

describe('activityDraft', () => {
  it('reads the start, the duration and the distance entered', () => {
    expect(activityDraft(valid, 'America/Toronto')).toEqual({
      start: new Date(STARTED_AT),
      durationSeconds: 3723,
      distanceMeters: 12_500,
    });
  });

  it('leaves out what does not read as a value yet', () => {
    expect(
      activityDraft(
        {
          ...valid,
          start_hour: '',
          start_minute: '',
          hours: '',
          minutes: '0',
          seconds: '',
          distance_km: '12,',
        },
        'America/Toronto',
      ),
    ).toEqual({});
    expect(activityDraft({ ...valid, hours: '25', distance_km: '0' }, 'America/Toronto')).toEqual({
      start: new Date(STARTED_AT),
    });
  });
});
