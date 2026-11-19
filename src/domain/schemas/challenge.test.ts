import en from '../../i18n/en.json';
import fr from '../../i18n/fr.json';
import { challengeCreateSchema } from './challenge';

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
  elimination_step_km: 2,
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
      elimination_step_km: 2,
      factors: { ride: 0.3 },
    });
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
      ['Split here', 'a paragraph separator'],
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

    it.each([0, -1, 100.1, 2.25, Number.NaN])('refuses %d km', (km) => {
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
  });

  it('only gives messages that exist in French and English', () => {
    const wrong = [
      { title: 'ab', description: 'a'.repeat(2001), visibility: undefined, weeks: 1 },
      { title: 'a\nb\nc', description: '\u200b', start_date: '', timezone: '' },
      { start_date: '2020-01-01' },
      { elimination_step_km: 0, factors: { ride: 3 } },
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

    expect(new Set(messages).size).toBe(11);
    for (const message of messages) {
      expect(typeof lookup(fr, message), message).toBe('string');
      expect(typeof lookup(en, message), message).toBe('string');
    }
  });
});
