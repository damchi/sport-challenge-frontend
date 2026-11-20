import { z } from 'zod';

// Profile rules of the API contract (Pseudo, PersonName, Language). Error
// messages are translation keys, so the schema stays free of any language.

export const PSEUDO_PATTERN = /^[A-Za-z0-9_.-]+$/;

// Letters of any alphabet, in words joined by one space, -, ' or ’, each
// starting with a letter.
export const PERSON_NAME_PATTERN = /^\p{L}[\p{L}\p{M}]*(?:[ '’-]\p{L}[\p{L}\p{M}]*)*$/u;

const PERSON_NAME_MAX = 50;

// Counted in characters like the contract's maxLength, not UTF-16 units.
const personName = z
  .string()
  .trim()
  .min(1, 'profile.name.required')
  .refine((name) => [...name].length <= PERSON_NAME_MAX, 'profile.name.length')
  .refine((name) => PERSON_NAME_PATTERN.test(name), 'profile.name.characters');

export const profileSchema = z.object({
  pseudo: z
    .string()
    .trim()
    .min(3, 'profile.pseudo.length')
    .max(20, 'profile.pseudo.length')
    .regex(PSEUDO_PATTERN, 'profile.pseudo.characters'),
  first_name: personName,
  last_name: personName,
  language: z.enum(['fr', 'en']),
});

export type ProfileInput = z.infer<typeof profileSchema>;
