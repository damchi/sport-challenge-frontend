import {
  activityCreateSchema,
  activityFormFieldOf,
  cleanSportLabel,
  localDateTime,
  toLocalDateTime,
  type ActivityCreateInput,
  type ActivitySport,
} from './activity';

const sports: ActivitySport[] = [
  { code: 'run', distance_mode: 'required' },
  { code: 'yoga', distance_mode: 'none' },
  { code: 'other', distance_mode: 'optional' },
];

// Read in the device's time zone, like the form's field.
const now = new Date(2026, 10, 20, 12, 0);
const schema = activityCreateSchema(() => now, sports);

const valid: ActivityCreateInput = {
  sport_code: 'run',
  sport_label: '',
  started_at: '2026-11-20T07:30',
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
      started_at: new Date(2026, 10, 20, 7, 30).toISOString(),
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
        started_at: new Date(2026, 10, 20, 7, 30).toISOString(),
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
    it.each(['', '2026-11-20', 'yesterday'])('wants a date and a time, not %j', (startedAt) => {
      expect(errorsOf({ started_at: startedAt }).started_at).toBe(
        'activityForm.fields.startedAt.required',
      );
    });

    it('is never in the future nor before 2000', () => {
      expect(errorsOf({ started_at: '2026-11-20T12:01' }).started_at).toBe(
        'activityForm.fields.startedAt.range',
      );
      // 2000-01-01 is in UTC: a day earlier is before it in any time zone.
      expect(errorsOf({ started_at: '1999-12-30T23:59' }).started_at).toBe(
        'activityForm.fields.startedAt.range',
      );
    });

    it('reads the current instant at each check', () => {
      let current = new Date(2026, 10, 20, 7, 0);
      const live = activityCreateSchema(() => current, sports);
      expect(live.safeParse(valid).success).toBe(false);
      current = new Date(2026, 10, 20, 9, 0);
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
        errorsOf({ started_at: '2026-11-20T11:00', hours: '1', minutes: '5', seconds: '' }),
      ).toEqual({});
      expect(
        errorsOf({ started_at: '2026-11-20T11:00', hours: '1', minutes: '5', seconds: '1' }).hours,
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

describe('cleanSportLabel', () => {
  it('collapses and trims the spaces', () => {
    expect(cleanSportLabel(' a   b\t')).toBe('a b');
  });
});

describe('localDateTime and toLocalDateTime', () => {
  it('read and write a native date and time field in the device time zone', () => {
    expect(localDateTime('2026-11-20T07:30')).toEqual(new Date(2026, 10, 20, 7, 30));
    expect(localDateTime('2026-02-30T07:30')).toBeUndefined();
    expect(toLocalDateTime(new Date(2026, 0, 5, 9, 7, 42))).toBe('2026-01-05T09:07');
  });
});

describe('activityFormFieldOf', () => {
  it('gives the form field of a refused request field', () => {
    expect(activityFormFieldOf('duration_seconds')).toBe('hours');
    expect(activityFormFieldOf('distance_meters')).toBe('distance_km');
    expect(activityFormFieldOf('started_at')).toBe('started_at');
    expect(activityFormFieldOf('constructor')).toBeUndefined();
  });
});
