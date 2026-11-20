import { z } from 'zod';

// Profile rules of the API contract (Pseudo, PersonName, Language). Error
// messages are translation keys, so the schema stays free of any language.

export const PSEUDO_PATTERN = /^[A-Za-z0-9_.-]+$/;

// Letters of any alphabet, in words joined by one space, -, ' or ’, each
// starting with a letter.
export const PERSON_NAME_PATTERN = /^\p{L}[\p{L}\p{M}]*(?:[ '’-]\p{L}[\p{L}\p{M}]*)*$/u;

const PERSON_NAME_MAX = 50;

/**
 * A name as the contract writes it, from what was typed: any run of spaces
 * (non-breaking ones too) becomes one space, and spaces around -, ' or ’
 * go ("Jean  -  Paul" → "Jean-Paul").
 */
export function normalizeName(name: string): string {
  return name
    .replace(/\s+/gu, ' ')
    .replace(/ ?([-'’]) ?/g, '$1')
    .trim();
}

// Counted in characters like the contract's maxLength, not UTF-16 units.
const personName = z
  .string()
  .overwrite(normalizeName)
  .min(1, 'profile.name.required')
  .refine((name) => [...name].length <= PERSON_NAME_MAX, 'profile.name.length')
  .refine((name) => PERSON_NAME_PATTERN.test(name), 'profile.name.characters');

// Optional: it can be left empty, or emptied to remove it.
const pseudo = z
  .string()
  .trim()
  .refine((value) => value === '' || (value.length >= 3 && value.length <= 20), {
    message: 'profile.pseudo.length',
  })
  .refine((value) => value === '' || PSEUDO_PATTERN.test(value), {
    message: 'profile.pseudo.characters',
  });

export const profileSchema = z.object({
  pseudo,
  first_name: personName,
  last_name: personName,
  language: z.enum(['fr', 'en']),
});

export type ProfileInput = z.infer<typeof profileSchema>;

/** The first and last name, changed from the profile page. */
export const namesSchema = z.object({ first_name: personName, last_name: personName });

export type NamesInput = z.infer<typeof namesSchema>;

/** Whether the names typed, once tidied, are the ones the profile has. */
export function sameNames(
  typed: NamesInput,
  saved: { first_name: string | null; last_name: string | null },
): boolean {
  return (
    normalizeName(typed.first_name) === (saved.first_name ?? '') &&
    normalizeName(typed.last_name) === (saved.last_name ?? '')
  );
}

/** The pseudo alone, changed or removed from the profile page. */
export const pseudoSchema = z.object({ pseudo });

export type PseudoInput = z.infer<typeof pseudoSchema>;

/**
 * The pseudo to send: an empty field removes a pseudo the profile has
 * (null) and is left out otherwise, as there is nothing to remove.
 */
export function pseudoUpdate(value: string, current: string | null): { pseudo?: string | null } {
  if (value !== '') return { pseudo: value };
  return current === null ? {} : { pseudo: null };
}

/** The PATCH /me body of the onboarding. */
export function profileUpdate({ pseudo: value, ...rest }: ProfileInput, current: string | null) {
  return { ...pseudoUpdate(value, current), ...rest };
}
