import {
  activityCreateSchema,
  activityDraft,
  activityFormFieldOf,
  activityFormValues,
  cleanSportLabel,
  type ActivityCreateInput,
  type ActivitySport,
} from './activity';

const sports: ActivitySport[] = [
  { code: 'run', distance_mode: 'required' },
  { code: 'yoga', distance_mode: 'none' },
  { code: 'other', distance_mode: 'optional' },
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
  start_time: '07:30',
  hours: '1',
  minutes: '02',
  seconds: '3',
  distance_km: '12,5',
};

function errorsOf(input: Partial<ActivityCreateInput>): Record<string, string> {
  const result = schema.safeParse({ ...valid, ...input });
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
  );
}

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
      ['', '07:30'],
      ['2026-11-20', ''],
      ['yesterday', '07:30'],
      ['2026-11-20', '7h30'],
    ])('wants a date and a time, not %j at %j', (date, time) => {
      // The one error goes on the day.
      expect(errorsOf({ start_date: date, start_time: time })).toEqual({
        start_date: 'activityForm.fields.startedAt.required',
      });
    });

    it('is never in the future nor before 2000', () => {
      expect(errorsOf({ start_time: '12:01' }).start_date).toBe(
        'activityForm.fields.startedAt.range',
      );
      // 2000-01-01 is in UTC: a day earlier is before it in any time zone.
      expect(errorsOf({ start_date: '1999-12-30', start_time: '23:59' }).start_date).toBe(
        'activityForm.fields.startedAt.range',
      );
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
      expect(errorsOf({ start_time: '11:00', hours: '1', minutes: '5', seconds: '' })).toEqual({});
      expect(errorsOf({ start_time: '11:00', hours: '1', minutes: '5', seconds: '1' }).hours).toBe(
        'activityForm.fields.duration.future',
      );
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
      },
      'America/Toronto',
      'fr',
    );

    expect(values).toEqual({ ...valid, minutes: '2' });
    // Sent again, it gives the same activity.
    expect(schema.parse(values)).toEqual({
      sport_code: 'run',
      started_at: STARTED_AT,
      duration_seconds: 3723,
      distance_meters: 12_500,
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
        },
        'America/Toronto',
        'en',
      ),
    ).toEqual({
      sport_code: 'other',
      sport_label: 'Padel',
      start_date: '2026-11-20',
      start_time: '07:30',
      hours: '1',
      minutes: '',
      seconds: '',
      distance_km: '',
    });
  });

  it('writes the distance with the decimal point of the language', () => {
    const run = {
      sport_code: 'run',
      sport_label: null,
      started_at: STARTED_AT,
      duration_seconds: 60,
      distance_meters: 1_234_567,
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
          start_time: '',
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
