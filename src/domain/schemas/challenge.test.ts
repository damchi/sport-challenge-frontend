import en from '../../i18n/en.json';
import fr from '../../i18n/fr.json';
import { challengeCreateSchema } from './challenge';

const valid = {
  title: 'Spring run',
  description: '',
  visibility: 'private' as const,
  members_can_invite: false,
};

function firstMessage(input: Record<string, unknown>): string | undefined {
  const result = challengeCreateSchema.safeParse({ ...valid, ...input });
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe('challengeCreateSchema', () => {
  it('accepts the contract fields, the title without surrounding spaces', () => {
    expect(
      challengeCreateSchema.parse({
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

  it('only gives messages that exist in French and English', () => {
    const wrong = [
      { title: 'ab', description: 'a'.repeat(2001), visibility: undefined },
      { title: 'a\nb\nc', description: '\u200b', visibility: 'friends' },
    ];
    const messages = wrong.flatMap(
      (input) =>
        challengeCreateSchema
          .safeParse({ ...valid, ...input })
          .error?.issues.map((issue) => issue.message) ?? [],
    );
    const lookup = (texts: unknown, key: string) =>
      key
        .split('.')
        .reduce<unknown>(
          (node, part) =>
            typeof node === 'object' && node !== null ? Reflect.get(node, part) : undefined,
          texts,
        );

    expect(new Set(messages).size).toBe(5);
    for (const message of messages) {
      expect(typeof lookup(fr, message), message).toBe('string');
      expect(typeof lookup(en, message), message).toBe('string');
    }
  });
});
