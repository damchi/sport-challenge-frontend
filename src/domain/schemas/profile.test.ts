import { profileSchema } from './profile';

const valid = { pseudo: 'marie_92', language: 'fr' as const };

describe('profileSchema', () => {
  it('accepts the contract pseudo, without surrounding spaces', () => {
    expect(profileSchema.parse({ ...valid, pseudo: ' jean.luc-2 ' })).toEqual({
      pseudo: 'jean.luc-2',
      language: 'fr',
    });
  });

  it.each([
    ['ab', 'profile.pseudo.length'],
    ['a'.repeat(21), 'profile.pseudo.length'],
    ['marie 92', 'profile.pseudo.characters'],
    ['éloïse', 'profile.pseudo.characters'],
  ])('refuses %j with %s', (pseudo, message) => {
    const result = profileSchema.safeParse({ ...valid, pseudo });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });

  it('only knows French and English', () => {
    expect(profileSchema.safeParse({ ...valid, language: 'es' }).success).toBe(false);
  });
});
