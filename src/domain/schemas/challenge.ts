import { z } from 'zod';

// Challenge creation rules of the API contract (ChallengeCreate). Lengths count
// characters (code points), as the server does, not UTF-16 units. Error
// messages are translation keys, so the schema stays free of any language.

const LINE_BREAKS_AND_TAB = new Set(['\n', '\r', '\t']);

// Formatting characters (Unicode Cf) the contract keeps: joiners, direction
// marks and the tags of flags.
function isKeptFormat(codePoint: number): boolean {
  return (
    (codePoint >= 0x200c && codePoint <= 0x200f) || (codePoint >= 0xe0020 && codePoint <= 0xe007f)
  );
}

function isRefused(char: string, allowed: ReadonlySet<string>): boolean {
  if (allowed.has(char)) {
    return false;
  }
  if (char === '\u2028' || char === '\u2029' || /\p{Cc}/u.test(char)) {
    return true;
  }
  // `codePointAt(0)` is defined: `char` is one code point of a string.
  return /\p{Cf}/u.test(char) && !isKeptFormat(char.codePointAt(0) ?? 0);
}

function hasOnlyAllowedCharacters(text: string, allowed: ReadonlySet<string>): boolean {
  return [...text].every((char) => !isRefused(char, allowed));
}

// Number of characters as the server counts them (code points).
function characterCount(text: string): number {
  return [...text].length;
}

// The kept formatting characters are invisible: they do not count as visible.
function visibleCount(text: string): number {
  return [...text].filter((char) => !/\p{Cf}/u.test(char)).length;
}

const TITLE_MAX_LENGTH = 80;
const DESCRIPTION_MAX_LENGTH = 2000;

export const challengeCreateSchema = z.object({
  title: z
    .string()
    .trim()
    .refine(
      (title) => characterCount(title) <= TITLE_MAX_LENGTH && visibleCount(title) >= 3,
      'challengeCreate.fields.title.length',
    )
    .refine(
      (title) => hasOnlyAllowedCharacters(title, new Set()),
      'challengeCreate.fields.title.characters',
    ),
  description: z
    .string()
    .refine(
      (description) => characterCount(description) <= DESCRIPTION_MAX_LENGTH,
      'challengeCreate.fields.description.length',
    )
    .refine(
      (description) => hasOnlyAllowedCharacters(description, LINE_BREAKS_AND_TAB),
      'challengeCreate.fields.description.characters',
    ),
  // No default: the creator chooses it.
  visibility: z.enum(['public', 'private'], 'challengeCreate.fields.visibility.required'),
  members_can_invite: z.boolean(),
});

/** What the form holds while it is filled in. */
export type ChallengeCreateInput = z.input<typeof challengeCreateSchema>;
/** What the form gives once valid. */
export type ChallengeCreateValues = z.output<typeof challengeCreateSchema>;
