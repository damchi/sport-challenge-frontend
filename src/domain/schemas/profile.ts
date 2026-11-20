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

// Optional until set: once given, the API keeps it (it can be changed, not
// removed). Left empty, it is not sent.
function pseudoField(required: boolean) {
  return z
    .string()
    .trim()
    .refine((pseudo) => pseudo !== '' || !required, { message: 'profile.pseudo.required' })
    .refine((pseudo) => pseudo === '' || (pseudo.length >= 3 && pseudo.length <= 20), {
      message: 'profile.pseudo.length',
    })
    .refine((pseudo) => pseudo === '' || PSEUDO_PATTERN.test(pseudo), {
      message: 'profile.pseudo.characters',
    });
}

/** The onboarding: `hasPseudo` when the profile already has one. */
export function profileSchema(hasPseudo: boolean) {
  return z.object({
    pseudo: pseudoField(hasPseudo),
    first_name: personName,
    last_name: personName,
    language: z.enum(['fr', 'en']),
  });
}

export type ProfileInput = z.infer<ReturnType<typeof profileSchema>>;

/** The PATCH /me body: an empty pseudo is left out (the API refuses null). */
export function profileUpdate({ pseudo, ...rest }: ProfileInput) {
  return pseudo === '' ? rest : { pseudo, ...rest };
}

/** The pseudo alone, changed from the profile page. */
export function pseudoSchema(hasPseudo: boolean) {
  return z.object({ pseudo: pseudoField(hasPseudo) });
}

export type PseudoInput = z.infer<ReturnType<typeof pseudoSchema>>;
