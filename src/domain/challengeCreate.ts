import type { ChallengeCreateValues } from './schemas/challenge';

// From the creation form to the request, and back for the fields the server
// refuses. Pure functions, free of the API types.

/** A sport of the catalogue, as far as the distance factors go. */
export interface FactorSport {
  code: string;
  suggested_factor: number | null;
}

/**
 * Sports whose factor the creator may change: those with a distance, but the
 * run, the reference that always counts ×1 (API contract). Catalogue order.
 */
export function factorSports<S extends FactorSport>(
  sports: readonly S[],
): (S & { suggested_factor: number })[] {
  return sports.filter(
    (sport): sport is S & { suggested_factor: number } =>
      sport.suggested_factor !== null && sport.code !== 'run',
  );
}

/**
 * Sports in the order the user reads them: by name in their language, the
 * free "other" sport last. `name` gives a sport's name.
 */
export function sortSportsByName<S extends { code: string }>(
  sports: readonly S[],
  name: (code: string) => string,
  locale: string,
): S[] {
  const rank = (sport: S) => (sport.code === 'other' ? 1 : 0);
  return [...sports].sort(
    (a, b) => rank(a) - rank(b) || name(a.code).localeCompare(name(b.code), locale),
  );
}

/**
 * The creation request. Only the factors the creator changed are sent: the
 * others keep the catalogue's suggestion. X goes in meters.
 */
export function challengeCreateRequest(
  values: ChallengeCreateValues,
  sports: readonly FactorSport[],
) {
  const suggested = new Map(
    factorSports(sports).map((sport) => [sport.code, sport.suggested_factor]),
  );
  const changed = Object.entries(values.factors).filter(
    ([code, factor]) => suggested.has(code) && suggested.get(code) !== factor,
  );
  return {
    title: values.title,
    description: values.description,
    visibility: values.visibility,
    members_can_invite: values.members_can_invite,
    timezone: values.timezone,
    start_date: values.start_date,
    weeks: values.weeks,
    elimination_step_meters: Math.round(values.elimination_step_km * 1000),
    ...(changed.length > 0 && { distance_factors: Object.fromEntries(changed) }),
  };
}

/**
 * The form field of a field the server refused (`params.fields` of
 * validation_failed): "elimination_step_meters" is X in km,
 * "distance_factors.ride" a factor. Undefined for a field the form lacks.
 */
export function formFieldOf(serverField: string): string | undefined {
  if (serverField === 'elimination_step_meters') return 'elimination_step_km';
  if (serverField.startsWith('distance_factors.')) {
    return `factors.${serverField.slice('distance_factors.'.length)}`;
  }
  return [
    'title',
    'description',
    'visibility',
    'members_can_invite',
    'timezone',
    'start_date',
    'weeks',
  ].includes(serverField)
    ? serverField
    : undefined;
}
