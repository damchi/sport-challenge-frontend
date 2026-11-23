import { identityUpdate, profileSchema, profileUpdate, pseudoUpdate } from './profile';

const valid = {
  pseudo: 'marie_92',
  first_name: 'Marie',
  last_name: 'Tremblay',
  language: 'fr' as const,
};

function firstMessage(input: Record<string, unknown>): string | undefined {
  const result = profileSchema.safeParse({ ...valid, ...input });
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe('profileSchema', () => {
  it('accepts the contract fields, without surrounding spaces', () => {
    expect(
      profileSchema.parse({
        ...valid,
        pseudo: ' jean.luc-2 ',
        first_name: ' Marie-Ève ',
        last_name: '  N’Diaye ',
      }),
    ).toEqual({
      pseudo: 'jean.luc-2',
      first_name: 'Marie-Ève',
      last_name: 'N’Diaye',
      language: 'fr',
    });
  });

  it.each([
    ['ab', 'profile.pseudo.length'],
    ['a'.repeat(21), 'profile.pseudo.length'],
    ['marie 92', 'profile.pseudo.characters'],
    ['éloïse', 'profile.pseudo.characters'],
  ])('refuses the pseudo %j with %s', (pseudo, message) => {
    expect(firstMessage({ pseudo })).toBe(message);
  });

  describe.each(['first_name', 'last_name'])('%s', (field) => {
    it.each([
      ['É', 'one letter'],
      ['Jean Paul', 'words joined by a space'],
      ["O'Brien", 'an apostrophe'],
      ['Zoë', 'a precomposed accent'],
      ['Zoë', 'a combining accent'],
      ['Владимир', 'another alphabet'],
      ['é'.repeat(50), 'fifty characters'],
    ])('accepts %j (%s)', (name) => {
      expect(firstMessage({ [field]: name })).toBeUndefined();
    });

    it.each([
      ['Jean  Paul', 'Jean Paul'],
      ['Jean\u00a0Paul', 'Jean Paul'],
      [' Jean - Paul ', 'Jean-Paul'],
      ["O ' Brien", "O'Brien"],
      ['De  La\tFontaine', 'De La Fontaine'],
    ])('tidies the spaces of %j into %j', (typed, sent) => {
      const result = profileSchema.parse({ ...valid, [field]: typed });
      expect(result[field as 'first_name' | 'last_name']).toBe(sent);
    });

    it.each(['', '   '])('asks for %j', (name) => {
      expect(firstMessage({ [field]: name })).toBe('profile.name.required');
    });

    it('refuses more than fifty characters', () => {
      expect(firstMessage({ [field]: 'é'.repeat(51) })).toBe('profile.name.length');
    });

    it.each([
      ['Marie2', 'a digit'],
      ['Jean--Paul', 'two hyphens'],
      ['-Marie', 'a leading hyphen'],
      ['Marie-', 'a trailing hyphen'],
      ['Marie_Ève', 'an underscore'],
      ['🏃', 'an emoji'],
    ])('refuses %j (%s)', (name) => {
      expect(firstMessage({ [field]: name })).toBe('profile.name.characters');
    });
  });

  it('accepts an empty pseudo', () => {
    expect(profileSchema.parse({ ...valid, pseudo: '  ' }).pseudo).toBe('');
  });

  describe('pseudoUpdate', () => {
    it('sends a pseudo typed', () => {
      expect(pseudoUpdate('jean.luc', null)).toEqual({ pseudo: 'jean.luc' });
    });

    it('removes the pseudo the profile has when emptied', () => {
      expect(pseudoUpdate('', 'marie_92')).toEqual({ pseudo: null });
    });

    it('sends nothing when there is no pseudo to remove', () => {
      expect(pseudoUpdate('', null)).toEqual({});
    });
  });

  it('builds the onboarding update', () => {
    expect(profileUpdate({ ...valid, pseudo: '' }, null)).toEqual({
      first_name: 'Marie',
      last_name: 'Tremblay',
      language: 'fr',
    });
    expect(profileUpdate(valid, null)).toEqual(valid);
  });

  describe('identityUpdate', () => {
    const saved = { first_name: 'Jean-Paul', last_name: 'Tremblay', pseudo: 'jp' };

    it('sends nothing when the names typed, once tidied, and the pseudo are the saved ones', () => {
      expect(
        identityUpdate(
          { first_name: ' Jean - Paul ', last_name: 'Tremblay ', pseudo: ' jp ' },
          saved,
        ),
      ).toEqual({});
    });

    it('sends only what changed', () => {
      expect(
        identityUpdate({ first_name: 'Jean Paul', last_name: 'Tremblay', pseudo: 'jp' }, saved),
      ).toEqual({ first_name: 'Jean Paul' });
      expect(
        identityUpdate({ first_name: 'Jean-Paul', last_name: 'Gagnon', pseudo: 'jean.p' }, saved),
      ).toEqual({ last_name: 'Gagnon', pseudo: 'jean.p' });
    });

    it('removes an emptied pseudo', () => {
      expect(
        identityUpdate({ first_name: 'Jean-Paul', last_name: 'Tremblay', pseudo: '' }, saved),
      ).toEqual({ pseudo: null });
    });

    it('sends nothing for an empty pseudo the profile does not have', () => {
      expect(
        identityUpdate(
          { first_name: 'Jean-Paul', last_name: 'Tremblay', pseudo: '' },
          { ...saved, pseudo: null },
        ),
      ).toEqual({});
    });
  });

  it('only knows French and English', () => {
    expect(firstMessage({ language: 'es' })).toBeDefined();
  });
});
