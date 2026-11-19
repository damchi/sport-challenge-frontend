import en from './en.json';
import fr from './fr.json';
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

  it('finds the same keys and every plural form in fr.json and en.json', () => {
    expect(missingPluralForms(fr, 'fr')).toEqual([]);
    expect(missingPluralForms(en, 'en')).toEqual([]);
    expect(missingKeys(fr, en)).toEqual([]);
    expect(missingKeys(en, fr)).toEqual([]);
  });
});
