import en from '../../i18n/en.json';
import fr from '../../i18n/fr.json';
import { challengeCreateSchema, challengeUpdateSchema } from './challenge';

// Thursday 19 November 2026, 22:00 in Montréal, already the 20th in Paris.
const NOW = new Date('2026-11-20T03:00:00Z');
const schema = challengeCreateSchema(NOW);

const valid = {
  title: 'Spring run',
  description: '',
  visibility: 'private' as const,
  members_can_invite: false,
  weeks: 4,
  start_date: '2026-11-23',
  timezone: 'America/Toronto',
  reference_sport: 'run',
  cumulative_distance: true,
  elimination: true,
  elimination_step_km: 2,
  points: true,
  points_criteria: ['longest_duration', 'session_count'],
  points_podium: '10',
  points_min_session_minutes: 20,
  cumulative_elevation: true,
  factors: { ride: 0.3 },
};

function firstMessage(input: Record<string, unknown>): string | undefined {
  const result = schema.safeParse({ ...valid, ...input });
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe('challengeCreateSchema', () => {
  it('accepts the contract fields, the title without surrounding spaces', () => {
    expect(
      schema.parse({
        ...valid,
        title: '  Défi de printemps 🏃  ',
        visibility: 'public',
        members_can_invite: true,
      }),
    ).toEqual({
      title: 'Défi de printemps 🏃',
      description: '',
      visibility: 'public',
      members_can_invite: true,
      weeks: 4,
      start_date: '2026-11-23',
      timezone: 'America/Toronto',
      reference_sport: 'run',
      cumulative_distance: true,
      elimination: true,
      elimination_step_km: 2,
      points: true,
      points_criteria: ['longest_duration', 'session_count'],
      points_podium: '10',
      points_min_session_minutes: 20,
      cumulative_elevation: true,
      factors: { ride: 0.3 },
    });
  });

  it('accepts the cumulative time alone, without X nor factors to check', () => {
    expect(
      firstMessage({
        cumulative_distance: false,
        elimination: false,
        elimination_step_km: Number.NaN,
        points: false,
        points_criteria: [],
        points_podium: null,
        points_min_session_minutes: Number.NaN,
        factors: { ride: Number.NaN },
      }),
    ).toBeUndefined();
    expect(firstMessage({ elimination: false, elimination_step_km: undefined })).toBeUndefined();
  });

  it('asks for a reference sport', () => {
    expect(firstMessage({ reference_sport: '' })).toBe(
      'challengeCreate.fields.referenceSport.required',
    );
  });

  describe('title', () => {
    it.each([
      ['abc', 'three characters'],
      ['a'.repeat(80), 'eighty characters'],
      ['🏃'.repeat(80), 'eighty emoji, counted as characters and not UTF-16 units'],
      ['a‍b‍c', 'a kept joiner'],
    ])('accepts %j (%s)', (title) => {
      expect(firstMessage({ title })).toBeUndefined();
    });

    it.each([
      ['', 'empty'],
      ['ab', 'two characters'],
      ['  ab  ', 'two characters once trimmed'],
      ['a'.repeat(81), 'eighty-one characters'],
      ['a‍b‍', 'two visible characters and joiners'],
    ])('refuses %j (%s) for its length', (title) => {
      expect(firstMessage({ title })).toBe('challengeCreate.fields.title.length');
    });

    it.each([
      ['Spring\nrun', 'a line break'],
      ['Spring\trun', 'a tab'],
      ['Spring run', 'a line separator'],
      ['Spring‮run', 'a bidirectional override'],
      ['Spring​run', 'a zero-width space'],
    ])('refuses %j (%s)', (title) => {
      expect(firstMessage({ title })).toBe('challengeCreate.fields.title.characters');
    });
  });

  describe('description', () => {
    it.each([
      ['', 'empty'],
      ['Line one\nline two\r\n\tindented', 'line breaks and tabs'],
      ['Line one\u2028line two\u2029paragraph', 'line and paragraph separators'],
      ['🏃'.repeat(2000), '2000 characters'],
    ])('accepts %j (%s)', (description) => {
      expect(firstMessage({ description })).toBeUndefined();
    });

    it('refuses more than 2000 characters', () => {
      expect(firstMessage({ description: 'a'.repeat(2001) })).toBe(
        'challengeCreate.fields.description.length',
      );
    });

    it.each([
      ['Bell\u0007', 'a control character'],
      ['Hidden​', 'a zero-width space'],
    ])('refuses %j (%s)', (description) => {
      expect(firstMessage({ description })).toBe('challengeCreate.fields.description.characters');
    });
  });

  it('asks for a visibility', () => {
    expect(firstMessage({ visibility: undefined })).toBe(
      'challengeCreate.fields.visibility.required',
    );
    expect(firstMessage({ visibility: 'friends' })).toBe(
      'challengeCreate.fields.visibility.required',
    );
  });

  describe('weeks', () => {
    it.each([2, 52])('accepts %d', (weeks) => {
      expect(firstMessage({ weeks })).toBeUndefined();
    });

    it.each([1, 53, 2.5, Number.NaN])('refuses %d', (weeks) => {
      expect(firstMessage({ weeks })).toBe('challengeCreate.fields.weeks.range');
    });
  });

  describe('start date', () => {
    it.each(['', '2026-02-30', '23/11/2026'])('asks for a real day instead of %j', (start_date) => {
      expect(firstMessage({ start_date })).toBe('challengeCreate.fields.startDate.required');
    });

    it('takes today and the same day next year, in the chosen time zone', () => {
      expect(firstMessage({ start_date: '2026-11-19' })).toBeUndefined();
      expect(firstMessage({ start_date: '2027-11-19' })).toBeUndefined();
      expect(firstMessage({ start_date: '2026-11-20', timezone: 'Europe/Paris' })).toBeUndefined();
      expect(firstMessage({ start_date: '2027-11-20', timezone: 'Europe/Paris' })).toBeUndefined();
    });

    it.each([
      ['2026-11-18', 'America/Toronto', 'yesterday in Montréal'],
      ['2026-11-19', 'Europe/Paris', 'already yesterday in Paris'],
      ['2027-11-20', 'America/Toronto', 'after the same day next year'],
    ])('refuses %s in %s (%s)', (start_date, timezone) => {
      expect(firstMessage({ start_date, timezone })).toBe('challengeCreate.fields.startDate.range');
    });

    it('checks the range even when another field is wrong', () => {
      const result = schema.safeParse({ ...valid, title: '', start_date: '2020-01-01' });
      expect(result.error?.issues.map((issue) => issue.message)).toEqual([
        'challengeCreate.fields.title.length',
        'challengeCreate.fields.startDate.range',
      ]);
    });
  });

  it.each(['', 'Mars/Olympus_Mons'])('asks for a known time zone instead of %j', (timezone) => {
    expect(firstMessage({ timezone })).toBe('challengeCreate.fields.timezone.required');
  });

  describe('elimination increment', () => {
    it.each([0.1, 2, 2.5, 100])('accepts %d km', (km) => {
      expect(firstMessage({ elimination_step_km: km })).toBeUndefined();
    });

    it.each([0, -1, 100.1, 2.25, Number.NaN, undefined])('refuses %s km', (km) => {
      expect(firstMessage({ elimination_step_km: km })).toBe(
        'challengeCreate.fields.eliminationStep.range',
      );
    });
  });

  describe('distance factors', () => {
    it.each([0.1, 0.25, 2])('accepts %d', (factor) => {
      expect(firstMessage({ factors: { ride: factor } })).toBeUndefined();
    });

    it.each([0, 0.05, 2.01, 0.333, Number.NaN])('refuses %d, under its sport', (factor) => {
      const result = schema.safeParse({ ...valid, factors: { ride: 0.3, rowing: factor } });
      expect(result.error?.issues.map(({ message, path }) => [message, path])).toEqual([
        ['challengeCreate.fields.factors.range', ['factors', 'rowing']],
      ]);
    });

    it('checks them for the longest session by distance, without the total distance', () => {
      const factors = { ride: 3 };
      expect(
        firstMessage({
          cumulative_distance: false,
          points_criteria: ['longest_distance'],
          factors,
        }),
      ).toBe('challengeCreate.fields.factors.range');
      expect(firstMessage({ cumulative_distance: false, factors })).toBeUndefined();
      expect(
        firstMessage({
          cumulative_distance: false,
          points: false,
          points_criteria: ['longest_distance'],
          factors,
        }),
      ).toBeUndefined();
    });

    it('leaves out the reference, which keeps no field', () => {
      expect(
        firstMessage({ reference_sport: 'ride', factors: { ride: Number.NaN, run: 1 } }),
      ).toBeUndefined();
    });
  });

  describe('points', () => {
    it('asks for at least one criterion', () => {
      expect(firstMessage({ points_criteria: [] })).toBe(
        'challengeCreate.fields.pointsCriteria.required',
      );
    });

    it.each([undefined, null])('asks for a scale instead of %s', (podium) => {
      expect(firstMessage({ points_podium: podium })).toBe(
        'challengeCreate.fields.pointsPodium.required',
      );
    });

    it.each([1, 20, 180])('accepts a minimum session of %d min', (minutes) => {
      expect(firstMessage({ points_min_session_minutes: minutes })).toBeUndefined();
    });

    it.each([0, 181, 2.5, Number.NaN])('refuses a minimum session of %d min', (minutes) => {
      expect(firstMessage({ points_min_session_minutes: minutes })).toBe(
        'challengeCreate.fields.minSession.range',
      );
    });

    it('checks the minimum session with the number of sessions alone', () => {
      expect(
        firstMessage({
          points_criteria: ['longest_duration'],
          points_min_session_minutes: Number.NaN,
        }),
      ).toBeUndefined();
    });

    it('checks nothing without the points', () => {
      expect(
        firstMessage({
          points: false,
          points_criteria: [],
          points_podium: undefined,
          points_min_session_minutes: 0,
        }),
      ).toBeUndefined();
    });
  });

  it('only gives messages that exist in French and English', () => {
    const wrong = [
      { title: 'ab', description: 'a'.repeat(2001), visibility: undefined, weeks: 1 },
      { title: 'a\nb\nc', description: '\u200b', start_date: '', timezone: '' },
      { start_date: '2020-01-01' },
      { elimination_step_km: 0, factors: { ride: 3 } },
      { reference_sport: '' },
      { points_criteria: ['session_count'], points_podium: null, points_min_session_minutes: 0 },
      { points_criteria: [] },
    ];
    const messages = wrong.flatMap(
      (input) =>
        schema.safeParse({ ...valid, ...input }).error?.issues.map((issue) => issue.message) ?? [],
    );
    const lookup = (texts: unknown, key: string) =>
      key
        .split('.')
        .reduce<unknown>(
          (node, part) =>
            typeof node === 'object' && node !== null ? Reflect.get(node, part) : undefined,
          texts,
        );

    expect(new Set(messages).size).toBe(15);
    for (const message of messages) {
      expect(typeof lookup(fr, message), message).toBe('string');
      expect(typeof lookup(en, message), message).toBe('string');
    }
  });
});

describe('challengeUpdateSchema', () => {
  it('keeps the title without surrounding spaces, and an empty description', () => {
    expect(challengeUpdateSchema.parse({ title: '  Spring run ', description: '' })).toEqual({
      title: 'Spring run',
      description: '',
    });
  });

  it('applies the creation rules to the title and the description', () => {
    const messages = (input: { title: string; description: string }) =>
      challengeUpdateSchema.safeParse(input).error?.issues.map((issue) => issue.message);

    expect(messages({ title: 'ab', description: '' })).toEqual([
      'challengeCreate.fields.title.length',
    ]);
    expect(messages({ title: 'a\tbc', description: 'a'.repeat(2001) })).toEqual([
      'challengeCreate.fields.title.characters',
      'challengeCreate.fields.description.length',
    ]);
  });

  it('takes no other field: they are frozen at creation', () => {
    expect(
      challengeUpdateSchema.parse({ title: 'Spring run', description: '', visibility: 'public' }),
    ).toEqual({ title: 'Spring run', description: '' });
  });
});
