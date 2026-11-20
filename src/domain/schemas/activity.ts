import { z } from 'zod';
import { zonedDateTime } from '../challengeWindow';
import { characterCount, hasOnlyAllowedCharacters, visibleCount } from './text';

// Activity entry rules of the API contract (ActivityCreate). The form holds
// text, as typed; the schema gives the request. Error messages are
// translation keys, so the schema stays free of any language.

/** A sport of the catalogue, as far as the entry goes. */
export interface ActivitySport {
  code: string;
  distance_mode: 'required' | 'none' | 'optional';
}

const LABEL_MIN = 2;
const LABEL_MAX = 40;
const MAX_DURATION_SECONDS = 86_400;
const MAX_DISTANCE_METERS = 1_000_000;
// The server accepts an end up to 5 minutes ahead (clocks drift).
const END_TOLERANCE_MS = 5 * 60 * 1000;
const EARLIEST_START = Date.UTC(2000, 0, 1);

const WHOLE = /^\d+$/;
// Km with a point or a comma, 3 decimals at most (the meter).
const KM = /^\d+(?:[.,]\d{1,3})?$/;

/** The free label of the "other" sport as the server cleans it: spaces collapsed. */
export function cleanSportLabel(label: string): string {
  return label.replace(/\s+/gu, ' ').trim();
}

// A part of the duration: empty counts as 0.
function durationPart(value: string, max: number): number | undefined {
  const text = value.trim();
  if (text === '') return 0;
  if (!WHOLE.test(text)) return undefined;
  const number = Number(text);
  return number <= max ? number : undefined;
}

function durationSeconds(hours: string, minutes: string, seconds: string): number | undefined {
  const parts = [durationPart(hours, 24), durationPart(minutes, 59), durationPart(seconds, 59)];
  if (parts.some((part) => part === undefined)) return undefined;
  const [h = 0, m = 0, s = 0] = parts;
  return h * 3600 + m * 60 + s;
}

// Meters of a distance typed in km, or undefined when it is not one.
function distanceMeters(value: string): number | undefined {
  const text = value.trim();
  if (!KM.test(text)) return undefined;
  return Math.round(Number(text.replace(',', '.')) * 1000);
}

/**
 * Activity entry input. `now` gives the current instant at each check: the
 * activity is entered once done, so neither its start nor its end is in the
 * future. `sports` is the catalogue, whose distance mode tells whether the
 * distance is required, optional (the "other" sport) or absent. The start,
 * as a native field gives it, is read in `timeZone`.
 */
export function activityCreateSchema(
  now: () => Date,
  sports: readonly ActivitySport[],
  timeZone: string,
) {
  const modeOf = (code: string) => sports.find((sport) => sport.code === code)?.distance_mode;

  return z
    .object({
      sport_code: z.string(),
      sport_label: z.string(),
      started_at: z.string(),
      hours: z.string(),
      minutes: z.string(),
      seconds: z.string(),
      distance_km: z.string(),
    })
    .superRefine((input, context) => {
      const issue = (path: string, message: string) =>
        context.addIssue({ code: 'custom', path: [path], message });

      const mode = modeOf(input.sport_code);
      if (mode === undefined) issue('sport_code', 'activityForm.fields.sport.required');

      if (input.sport_code === 'other') {
        const label = cleanSportLabel(input.sport_label);
        if (characterCount(label) > LABEL_MAX || visibleCount(label) < LABEL_MIN) {
          issue('sport_label', 'activityForm.fields.sportLabel.length');
        } else if (!hasOnlyAllowedCharacters(label, new Set())) {
          issue('sport_label', 'activityForm.fields.sportLabel.characters');
        }
      }

      const start = zonedDateTime(input.started_at, timeZone);
      const current = now().getTime();
      if (!start) issue('started_at', 'activityForm.fields.startedAt.required');
      else if (start.getTime() < EARLIEST_START || start.getTime() > current) {
        issue('started_at', 'activityForm.fields.startedAt.range');
      }

      const duration = durationSeconds(input.hours, input.minutes, input.seconds);
      // The duration's one error goes on its first part.
      if (duration === undefined) issue('hours', 'activityForm.fields.duration.invalid');
      else if (duration < 1 || duration > MAX_DURATION_SECONDS) {
        issue('hours', 'activityForm.fields.duration.range');
      } else if (start && start.getTime() + duration * 1000 > current + END_TOLERANCE_MS) {
        issue('hours', 'activityForm.fields.duration.future');
      }

      if (mode === 'required' || (mode === 'optional' && input.distance_km.trim() !== '')) {
        const meters = distanceMeters(input.distance_km);
        if (input.distance_km.trim() === '') {
          issue('distance_km', 'activityForm.fields.distance.required');
        } else if (meters === undefined || meters < 1 || meters > MAX_DISTANCE_METERS) {
          issue('distance_km', 'activityForm.fields.distance.range');
        }
      }
    })
    .transform((input) => {
      const mode = modeOf(input.sport_code);
      const meters = mode === 'none' ? undefined : distanceMeters(input.distance_km);
      // Valid by now: the refinement above passed.
      const start = zonedDateTime(input.started_at, timeZone) ?? new Date(Number.NaN);
      return {
        sport_code: input.sport_code,
        ...(input.sport_code === 'other' && { sport_label: cleanSportLabel(input.sport_label) }),
        started_at: start.toISOString(),
        duration_seconds: durationSeconds(input.hours, input.minutes, input.seconds) ?? 0,
        ...(meters !== undefined && { distance_meters: meters }),
      };
    });
}

/** What the form holds while it is filled in. */
export type ActivityCreateInput = z.input<ReturnType<typeof activityCreateSchema>>;
/** The request, once the form is valid. */
export type ActivityCreateValues = z.output<ReturnType<typeof activityCreateSchema>>;

// Form field of each request field: the duration is three fields, whose
// error goes on the first one; the distance is typed in km.
const FORM_FIELDS = {
  sport_code: 'sport_code',
  sport_label: 'sport_label',
  started_at: 'started_at',
  duration_seconds: 'hours',
  distance_meters: 'distance_km',
} as const;

export type ActivityFormField = (typeof FORM_FIELDS)[keyof typeof FORM_FIELDS];

/**
 * The form field of a field the server refused (`params.fields` of
 * validation_failed). Undefined for a field the form lacks.
 */
export function activityFormFieldOf(serverField: string): ActivityFormField | undefined {
  return Object.hasOwn(FORM_FIELDS, serverField)
    ? FORM_FIELDS[serverField as keyof typeof FORM_FIELDS]
    : undefined;
}
