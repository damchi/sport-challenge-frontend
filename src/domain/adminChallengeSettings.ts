import {
  challengeCategories,
  DEFAULT_MIN_SESSION_MINUTES,
  factorSports,
  referenceHasDistance,
  usesDistanceFactors,
  type CatalogueSport,
} from './challengeCreate';
import { localDate } from './challengeWindow';
import {
  POINTS_CRITERIA,
  type ChallengeCreateInput,
  type ChallengeCreateValues,
} from './schemas/challenge';

// An admin changes any setting of a challenge with the creation's form
// (README §2.12 of the backend): from the challenge to the form, the fields
// changed, and the request, which names only those. Pure functions, free of
// the API types.

type PointsCriterion = (typeof POINTS_CRITERIA)[number];

/** A challenge's settings, as the admin's sheet of it gives them. */
export interface ChallengeSettings {
  title: string;
  description: string | null;
  visibility: 'public' | 'private';
  members_can_invite: boolean;
  timezone: string;
  reference_sport: string;
  /** The first instant, midnight of the first day in `timezone`. */
  starts_at: string;
  /** One per week of the challenge. */
  weeks: readonly unknown[];
  categories: readonly {
    type: string;
    params: {
      factors?: Record<string, number>;
      step_meters?: number;
      exercise?: string;
      step_repetitions?: number;
      criteria?: readonly string[];
      podium?: 5 | 10;
      min_session_seconds?: number;
    };
  }[];
}

function isCriterion(criterion: string): criterion is PointsCriterion {
  return (POINTS_CRITERIA as readonly string[]).includes(criterion);
}

/**
 * The form filled with the challenge's settings: its first day in its time
 * zone, X in km (or its exercise and X in repetitions), the minimum session in minutes, and the factors of the
 * category that uses them (the reference's left out: it counts ×1).
 */
export function settingsFormValues(challenge: ChallengeSettings): ChallengeCreateInput {
  const params = (type: string) =>
    challenge.categories.find((category) => category.type === type)?.params;
  const distance = params('cumulative_distance');
  const elimination = params('elimination');
  const points = params('points');
  const factors = Object.fromEntries(
    Object.entries(distance?.factors ?? points?.factors ?? {}).filter(
      ([code]) => code !== challenge.reference_sport,
    ),
  );
  const minSession = points?.min_session_seconds;
  return {
    title: challenge.title,
    description: challenge.description ?? '',
    visibility: challenge.visibility,
    members_can_invite: challenge.members_can_invite,
    weeks: challenge.weeks.length,
    start_date: localDate(new Date(challenge.starts_at), challenge.timezone),
    timezone: challenge.timezone,
    reference_sport: challenge.reference_sport,
    cumulative_distance: distance !== undefined,
    elimination: elimination !== undefined,
    elimination_step_km:
      elimination?.step_meters === undefined ? undefined : elimination.step_meters / 1000,
    elimination_exercise: elimination?.exercise ?? '',
    elimination_step_repetitions: elimination?.step_repetitions,
    points: points !== undefined,
    points_criteria: (points?.criteria ?? []).filter(isCriterion),
    points_podium: points?.podium === undefined ? null : points.podium === 10 ? '10' : '5',
    points_min_session_minutes:
      minSession === undefined ? DEFAULT_MIN_SESSION_MINUTES : Math.round(minSession / 60),
    cumulative_elevation: params('cumulative_elevation') !== undefined,
    factors,
  };
}

/** A setting the form may change, a factor being named by its sport. */
export type SettingField =
  | 'title'
  | 'description'
  | 'visibility'
  | 'members_can_invite'
  | 'weeks'
  | 'start_date'
  | 'timezone'
  | 'reference_sport'
  | 'cumulative_distance'
  | 'elimination'
  | 'elimination_step_km'
  | 'elimination_exercise'
  | 'elimination_step_repetitions'
  | 'points'
  | 'points_criteria'
  | 'points_podium'
  | 'points_min_session_minutes'
  | 'cumulative_elevation'
  | `factors.${string}`;

// Two numbers as the form holds them: NaN (an empty field) equals itself.
const sameNumber = (a: number | undefined, b: number | undefined) => Object.is(a, b);

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((item) => b.includes(item));

/**
 * The settings the form changes, in its order. A category's settings count
 * while it is on before and after (switched on or off, the category itself
 * is named), the elimination's in km or in repetitions as the reference
 * sport has a distance or not; a factor, while a category uses them, against the challenge's
 * (its suggestion when it had none).
 */
export function changedSettings(
  initial: ChallengeCreateInput,
  values: ChallengeCreateInput,
  sports: readonly CatalogueSport[],
): SettingField[] {
  const changed: SettingField[] = [];
  const add = (field: SettingField, different: boolean) => {
    if (different) changed.push(field);
  };
  add('title', initial.title.trim() !== values.title.trim());
  add('description', initial.description !== values.description);
  add('visibility', initial.visibility !== values.visibility);
  add('members_can_invite', initial.members_can_invite !== values.members_can_invite);
  add('weeks', !sameNumber(initial.weeks, values.weeks));
  add('start_date', initial.start_date !== values.start_date);
  add('timezone', initial.timezone !== values.timezone);
  add('reference_sport', initial.reference_sport !== values.reference_sport);
  add('cumulative_distance', initial.cumulative_distance !== values.cumulative_distance);
  add('elimination', initial.elimination !== values.elimination);
  const bothElimination = initial.elimination && values.elimination;
  const withDistance = referenceHasDistance(sports, values.reference_sport);
  add(
    'elimination_step_km',
    bothElimination &&
      withDistance &&
      !sameNumber(initial.elimination_step_km, values.elimination_step_km),
  );
  add(
    'elimination_exercise',
    bothElimination &&
      !withDistance &&
      initial.elimination_exercise !== values.elimination_exercise,
  );
  add(
    'elimination_step_repetitions',
    bothElimination &&
      !withDistance &&
      !sameNumber(initial.elimination_step_repetitions, values.elimination_step_repetitions),
  );
  add('points', initial.points !== values.points);
  const bothPoints = initial.points && values.points;
  add('points_criteria', bothPoints && !sameSet(initial.points_criteria, values.points_criteria));
  add('points_podium', bothPoints && initial.points_podium !== values.points_podium);
  add(
    'points_min_session_minutes',
    bothPoints &&
      initial.points_criteria.includes('session_count') &&
      values.points_criteria.includes('session_count') &&
      !sameNumber(initial.points_min_session_minutes, values.points_min_session_minutes),
  );
  add('cumulative_elevation', initial.cumulative_elevation !== values.cumulative_elevation);
  if (usesDistanceFactors(values)) {
    for (const { code, suggested } of factorSports(sports, values.reference_sport)) {
      const factor = values.factors[code];
      add(
        `factors.${code}`,
        factor !== undefined && !sameNumber(factor, initial.factors[code] ?? suggested),
      );
    }
  }
  return changed;
}

type Categories = ReturnType<typeof challengeCategories>;

// The same categories and settings, whatever the order the criteria were
// ticked in, as `changedSettings` reads them.
function sameCategories(a: Categories, b: Categories): boolean {
  const key = (categories: Categories) =>
    JSON.stringify({
      ...categories,
      ...(categories.points && {
        points: { ...categories.points, criteria: [...categories.points.criteria].sort() },
      }),
    });
  return key(a) === key(b);
}

/** The request of the change, without its reason. */
export interface SettingsUpdate {
  title?: string;
  description?: string;
  visibility?: 'public' | 'private';
  members_can_invite?: boolean;
  timezone?: string;
  start_date?: string;
  weeks?: number;
  reference_sport?: string;
  categories?: Categories;
  distance_factors?: Record<string, number>;
}

/**
 * The change's request (API contract, AdminChallengeUpdate): only the fields
 * that change, a field left out keeping its value. The categories go as a
 * whole once one of them or a setting changes (those left out are removed).
 * A new reference starts again from the suggested factors brought back to
 * it, the challenge's otherwise: the factors the form holds that differ from
 * those are sent, while a category uses them.
 */
export function settingsUpdate(
  initial: ChallengeCreateInput,
  values: ChallengeCreateValues,
  sports: readonly CatalogueSport[],
): SettingsUpdate {
  const update: SettingsUpdate = {};
  if (values.title !== initial.title.trim()) update.title = values.title;
  if (values.description !== initial.description) update.description = values.description;
  if (values.visibility !== initial.visibility) update.visibility = values.visibility;
  if (values.members_can_invite !== initial.members_can_invite) {
    update.members_can_invite = values.members_can_invite;
  }
  if (values.timezone !== initial.timezone) update.timezone = values.timezone;
  if (values.start_date !== initial.start_date) update.start_date = values.start_date;
  if (values.weeks !== initial.weeks) update.weeks = values.weeks;
  const newReference = values.reference_sport !== initial.reference_sport;
  if (newReference) update.reference_sport = values.reference_sport;
  const categories = challengeCategories(
    values,
    referenceHasDistance(sports, values.reference_sport),
  );
  const before = challengeCategories(
    initial,
    referenceHasDistance(sports, initial.reference_sport),
  );
  if (!sameCategories(categories, before)) {
    update.categories = categories;
  }
  if (usesDistanceFactors(values)) {
    const changed = factorSports(sports, values.reference_sport).flatMap(({ code, suggested }) => {
      const factor = values.factors[code];
      const kept = newReference ? suggested : (initial.factors[code] ?? suggested);
      return factor === undefined || factor === kept ? [] : [[code, factor] as const];
    });
    if (changed.length > 0) update.distance_factors = Object.fromEntries(changed);
  }
  return update;
}
