import { z } from 'zod';
import { isCalendarDate, isStartDateInRange, isTimeZone } from '../challengeWindow';
import {
  characterCount,
  hasOnlyAllowedCharacters,
  LINE_BREAKS_AND_TAB,
  visibleCount,
} from './text';

// Challenge creation rules of the API contract (ChallengeCreate). Lengths count
// characters (code points), as the server does, not UTF-16 units. Error
// messages are translation keys, so the schema stays free of any language.

// Whether `value` has at most `decimals` decimals (floating point aside).
function hasDecimals(value: number, decimals: number): boolean {
  const scaled = value * 10 ** decimals;
  return Math.abs(scaled - Math.round(scaled)) < 1e-9;
}

const TITLE_MAX_LENGTH = 80;
const DESCRIPTION_MAX_LENGTH = 2000;

// Title and description: the same rules at creation and when edited.
const titleField = z
  .string()
  .trim()
  .refine(
    (title) => characterCount(title) <= TITLE_MAX_LENGTH && visibleCount(title) >= 3,
    'challengeCreate.fields.title.length',
  )
  .refine(
    (title) => hasOnlyAllowedCharacters(title, new Set()),
    'challengeCreate.fields.title.characters',
  );

const descriptionField = z
  .string()
  .refine(
    (description) => characterCount(description) <= DESCRIPTION_MAX_LENGTH,
    'challengeCreate.fields.description.length',
  )
  .refine(
    (description) => hasOnlyAllowedCharacters(description, LINE_BREAKS_AND_TAB),
    'challengeCreate.fields.description.characters',
  );

/**
 * Challenge creation input. `now` dates "today" for the start date, which
 * must be between today and the same day next year in the chosen time zone.
 */
export function challengeCreateSchema(now: Date) {
  return z
    .object({
      title: titleField,
      description: descriptionField,
      // No default: the creator chooses it.
      visibility: z.enum(['public', 'private'], 'challengeCreate.fields.visibility.required'),
      members_can_invite: z.boolean(),
      weeks: z
        .number('challengeCreate.fields.weeks.range')
        .int('challengeCreate.fields.weeks.range')
        .min(2, 'challengeCreate.fields.weeks.range')
        .max(52, 'challengeCreate.fields.weeks.range'),
      start_date: z.string().refine(isCalendarDate, 'challengeCreate.fields.startDate.required'),
      timezone: z.string().refine(isTimeZone, 'challengeCreate.fields.timezone.required'),
      // A sport of the catalogue whose distance is required: the server
      // checks it against the catalogue.
      reference_sport: z.string().min(1, 'challengeCreate.fields.referenceSport.required'),
      // The cumulative time is always there; these two are chosen.
      cumulative_distance: z.boolean(),
      elimination: z.boolean(),
      // Increment X of the elimination, in km with one decimal: sent in
      // meters (1 to 100 000). Checked below, with the elimination only: an
      // empty field reads NaN.
      elimination_step_km: z.union([z.number(), z.nan()]).optional(),
      // Distance factor by sport code, 0.1 to 2 with two decimals at most.
      // Checked below, with the cumulative distance only.
      factors: z.record(z.string(), z.union([z.number(), z.nan()])),
    })
    .superRefine((values, context) => {
      const km = values.elimination_step_km;
      if (
        values.elimination &&
        (km === undefined || !(km > 0 && km <= 100 && hasDecimals(km, 1)))
      ) {
        context.addIssue({
          code: 'custom',
          path: ['elimination_step_km'],
          message: 'challengeCreate.fields.eliminationStep.range',
        });
      }
      if (!values.cumulative_distance) return;
      for (const [code, factor] of Object.entries(values.factors)) {
        // The reference keeps no field: it always counts ×1.
        if (code === values.reference_sport) continue;
        if (!(factor >= 0.1 && factor <= 2 && hasDecimals(factor, 2))) {
          context.addIssue({
            code: 'custom',
            path: ['factors', code],
            message: 'challengeCreate.fields.factors.range',
          });
        }
      }
    })
    .refine(({ start_date: startDate, timezone }) => isStartDateInRange(startDate, timezone, now), {
      path: ['start_date'],
      message: 'challengeCreate.fields.startDate.range',
      // Checked as soon as the date and the time zone are valid, whatever
      // the other fields: an error elsewhere would otherwise hide it.
      when: ({ issues }) =>
        !issues.some((issue) => ['start_date', 'timezone'].includes(String(issue.path?.[0]))),
    });
}

/** What the form holds while it is filled in. */
export type ChallengeCreateInput = z.input<ReturnType<typeof challengeCreateSchema>>;
/** What the form gives once valid. */
export type ChallengeCreateValues = z.output<ReturnType<typeof challengeCreateSchema>>;

/**
 * Edition of a challenge (ChallengeUpdate): only the title and the
 * description change, everything else is frozen at creation. An empty
 * description removes it.
 */
export const challengeUpdateSchema = z.object({
  title: titleField,
  description: descriptionField,
});

/** What the edit form holds. */
export type ChallengeUpdateInput = z.input<typeof challengeUpdateSchema>;
