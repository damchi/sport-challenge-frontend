import { z } from 'zod';
import { toZonedDateTime, zonedDateTime } from '../challengeWindow';
import { characterCount, hasOnlyAllowedCharacters, visibleCount } from './text';

// Activity entry rules of the API contract (ActivityCreate). The form holds
// text, as typed; the schema gives the request. Error messages are
// translation keys, so the schema stays free of any language.

/** A sport of the catalogue, as far as the entry goes. */
export interface ActivitySport {
  code: string;
  distance_mode: 'required' | 'none' | 'optional';
  elevation_allowed: boolean;
}

const LABEL_MIN = 2;
const LABEL_MAX = 40;
const MAX_DURATION_SECONDS = 86_400;
const MAX_DISTANCE_METERS = 1_000_000;
const MAX_ELEVATION_METERS = 20_000;
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
 * Whether the entry takes an elevation gain: the sport allows one (the
 * catalogue says so) and a distance is typed.
 */
export function takesElevation(
  sport: ActivitySport | undefined,
  distanceKm: string | undefined,
): boolean {
  // A sport without distance hides its field: text left there is no distance.
  return (
    sport?.elevation_allowed === true &&
    sport.distance_mode !== 'none' &&
    (distanceKm ?? '').trim() !== ''
  );
}

// Meters of an elevation gain typed as a whole number, or undefined when it
// is not one.
function elevationMeters(value: string): number | undefined {
  const text = value.trim();
  if (!WHOLE.test(text)) return undefined;
  const number = Number(text);
  return number <= MAX_ELEVATION_METERS ? number : undefined;
}

// A time of day as typed, on 24 hours: "07:30", "7:30", "7h30", "7.30",
// "0730" or "7h".
const CLOCK = /^(\d{1,2})(?:\s*[:hH.]?\s*(\d{2})|\s*[hH])$/;

/**
 * A time of day typed on 24 hours, written HH:MM ("7h30" → "07:30"), or
 * undefined when it is not one. A native time field is not used: it follows
 * the browser's language, AM/PM in English whatever the app's language.
 */
export function clockTime(text: string): string | undefined {
  const match = CLOCK.exec(text.trim());
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? '0');
  if (hours > 23 || minutes > 59) return undefined;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}`;
}

// The start, a day as a native date field gives it and a time as typed,
// read in `timeZone`.
function startOf(date: string, time: string, timeZone: string): Date | undefined {
  const clock = clockTime(time);
  return clock === undefined ? undefined : zonedDateTime(`${date}T${clock}`, timeZone);
}

/**
 * Activity entry input. `now` gives the current instant at each check: the
 * activity is entered once done, so neither its start nor its end is in the
 * future. `sports` is the catalogue, whose distance mode tells whether the
 * distance is required, optional (the "other" sport) or absent, and which
 * sports take an elevation gain (optional, with a distance). The start,
 * a day as a native field gives it and a time typed on 24 hours, is read in
 * `timeZone`; its one error goes on the day.
 */
export function activityCreateSchema(
  now: () => Date,
  sports: readonly ActivitySport[],
  timeZone: string,
) {
  const sportOf = (code: string) => sports.find((sport) => sport.code === code);
  const modeOf = (code: string) => sportOf(code)?.distance_mode;
  // Typed and taken by the entry: otherwise it is neither checked nor sent.
  const elevationOf = (input: { sport_code: string; distance_km: string; elevation_m: string }) =>
    takesElevation(sportOf(input.sport_code), input.distance_km) && input.elevation_m.trim() !== ''
      ? input.elevation_m
      : undefined;

  return z
    .object({
      sport_code: z.string(),
      sport_label: z.string(),
      start_date: z.string(),
      start_time: z.string(),
      hours: z.string(),
      minutes: z.string(),
      seconds: z.string(),
      distance_km: z.string(),
      elevation_m: z.string(),
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

      const start = startOf(input.start_date, input.start_time, timeZone);
      const current = now().getTime();
      if (!start) {
        const unreadTime = input.start_time.trim() !== '' && !clockTime(input.start_time);
        issue(
          'start_date',
          unreadTime
            ? 'activityForm.fields.startedAt.timeFormat'
            : 'activityForm.fields.startedAt.required',
        );
      } else if (start.getTime() < EARLIEST_START || start.getTime() > current) {
        issue('start_date', 'activityForm.fields.startedAt.range');
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

      const elevation = elevationOf(input);
      if (elevation !== undefined && elevationMeters(elevation) === undefined) {
        issue('elevation_m', 'activityForm.fields.elevation.range');
      }
    })
    .transform((input) => {
      const mode = modeOf(input.sport_code);
      const meters = mode === 'none' ? undefined : distanceMeters(input.distance_km);
      // Left out when empty: on a change, that removes it.
      const elevation = elevationOf(input);
      const climb = elevation === undefined ? undefined : elevationMeters(elevation);
      // Valid by now: the refinement above passed.
      const start = startOf(input.start_date, input.start_time, timeZone) ?? new Date(Number.NaN);
      return {
        sport_code: input.sport_code,
        ...(input.sport_code === 'other' && { sport_label: cleanSportLabel(input.sport_label) }),
        started_at: start.toISOString(),
        duration_seconds: durationSeconds(input.hours, input.minutes, input.seconds) ?? 0,
        ...(meters !== undefined && { distance_meters: meters }),
        ...(climb !== undefined && { elevation_gain_meters: climb }),
      };
    });
}

/** What the form holds while it is filled in. */
export type ActivityCreateInput = z.input<ReturnType<typeof activityCreateSchema>>;
/** The request, once the form is valid. */
export type ActivityCreateValues = z.output<ReturnType<typeof activityCreateSchema>>;

/** What is entered so far that reads as a value, for a summary of the entry. */
interface ActivityDraft {
  start?: Date;
  durationSeconds?: number;
  distanceMeters?: number;
}

/**
 * The start, duration and distance of an entry, each once it reads as one
 * (start read in `timeZone`, duration of 1 second to 24 hours, distance
 * over 0): nothing is computed from them.
 */
export function activityDraft(input: ActivityCreateInput, timeZone: string): ActivityDraft {
  const start = startOf(input.start_date, input.start_time, timeZone);
  const duration = durationSeconds(input.hours, input.minutes, input.seconds);
  const meters = distanceMeters(input.distance_km);
  return {
    ...(start && { start }),
    ...(duration !== undefined &&
      duration >= 1 &&
      duration <= MAX_DURATION_SECONDS && { durationSeconds: duration }),
    ...(meters !== undefined &&
      meters >= 1 &&
      meters <= MAX_DISTANCE_METERS && { distanceMeters: meters }),
  };
}

/** A recorded activity, as far as its entry goes. */
export interface RecordedActivity {
  sport_code: string;
  sport_label: string | null;
  started_at: string;
  duration_seconds: number;
  distance_meters: number | null;
  elevation_gain_meters: number | null;
}

/**
 * What the form holds to change a recorded activity: its start read in
 * `timeZone` (day and time to the minute, as entered), its duration in parts, its distance
 * in km written in the user's language, its elevation gain in meters.
 */
export function activityFormValues(
  activity: RecordedActivity,
  timeZone: string,
  locale: string,
): ActivityCreateInput {
  const {
    duration_seconds: duration,
    distance_meters: meters,
    elevation_gain_meters: elevation,
  } = activity;
  const part = (value: number) => (value === 0 ? '' : String(value));
  const [startDate = '', startTime = ''] = toZonedDateTime(
    new Date(activity.started_at),
    timeZone,
  ).split('T');
  return {
    sport_code: activity.sport_code,
    sport_label: activity.sport_label ?? '',
    start_date: startDate,
    start_time: startTime,
    hours: part(Math.floor(duration / 3600)),
    minutes: part(Math.floor(duration / 60) % 60),
    seconds: part(duration % 60),
    distance_km:
      meters === null
        ? ''
        : new Intl.NumberFormat(locale, { maximumFractionDigits: 3, useGrouping: false }).format(
            meters / 1000,
          ),
    elevation_m: elevation === null ? '' : String(elevation),
  };
}

// Form field of each request field: the start is two fields and the
// duration three, whose error goes on the first one; the distance is typed
// in km, the elevation gain in meters.
const FORM_FIELDS = {
  sport_code: 'sport_code',
  sport_label: 'sport_label',
  started_at: 'start_date',
  duration_seconds: 'hours',
  distance_meters: 'distance_km',
  elevation_gain_meters: 'elevation_m',
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
