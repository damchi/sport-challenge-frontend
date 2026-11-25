import en from './en.json';
import fr from './fr.json';
import adminEn from './admin/en.json';
import adminFr from './admin/fr.json';
import landingEn from './landing/en.json';
import landingFr from './landing/fr.json';
import startupEn from './startup/en.json';
import startupFr from './startup/fr.json';
import { missingKeys, missingPluralForms } from './parity';

describe('missingKeys', () => {
  it('lists the nested keys one file lacks', () => {
    const reference = { home: { title: 'x', subtitle: 'y' }, errors: { unknown: 'z' } };
    const other = { home: { title: 'x' } };

    expect(missingKeys(reference, other)).toEqual(['errors.unknown', 'home.subtitle']);
  });

  it('compares plural forms by their base key', () => {
    const french = { km_one: 'a', km_many: 'b', km_other: 'c' };
    const english = { km_one: 'a', km_other: 'c' };

    expect(missingKeys(french, english)).toEqual([]);
    expect(missingKeys(english, french)).toEqual([]);
  });

  it('lists the plural forms a language needs and a key lacks', () => {
    const englishOnlyOne = { km_one: 'a' };
    const frenchWithoutMany = { km_one: 'a', km_other: 'c' };

    expect(missingPluralForms(englishOnlyOne, 'en')).toEqual(['km_other']);
    expect(missingPluralForms(frenchWithoutMany, 'fr')).toEqual(['km_many']);
    expect(missingPluralForms({ title: 'x' }, 'fr')).toEqual([]);
  });

  it('lists the ordinal forms a language needs and a key lacks', () => {
    const english = { rank_ordinal_one: 'a', rank_ordinal_other: 'b' };
    const french = { rank_ordinal_one: 'a', rank_ordinal_other: 'b' };

    expect(missingPluralForms(english, 'en')).toEqual(['rank_ordinal_few', 'rank_ordinal_two']);
    // French ordinals have no `many`, unlike its cardinals.
    expect(missingPluralForms(french, 'fr')).toEqual([]);
    expect(missingKeys(english, { rank: 'x' })).toEqual([]);
  });

  it('finds the same keys and every plural form in fr.json and en.json', () => {
    expect(missingPluralForms(fr, 'fr')).toEqual([]);
    expect(missingPluralForms(en, 'en')).toEqual([]);
    expect(missingKeys(fr, en)).toEqual([]);
    expect(missingKeys(en, fr)).toEqual([]);
  });

  it('finds the same keys and every plural form in the admin section files', () => {
    expect(missingPluralForms(adminFr, 'fr')).toEqual([]);
    expect(missingPluralForms(adminEn, 'en')).toEqual([]);
    expect(missingKeys(adminFr, adminEn)).toEqual([]);
    expect(missingKeys(adminEn, adminFr)).toEqual([]);
  });

  it('finds the same keys and every plural form in the landing page files', () => {
    expect(missingPluralForms(landingFr, 'fr')).toEqual([]);
    expect(missingPluralForms(landingEn, 'en')).toEqual([]);
    expect(missingKeys(landingFr, landingEn)).toEqual([]);
    expect(missingKeys(landingEn, landingFr)).toEqual([]);
  });

  it('finds the same keys in the startup files', () => {
    expect(missingKeys(startupFr, startupEn)).toEqual([]);
    expect(missingKeys(startupEn, startupFr)).toEqual([]);
  });
});
