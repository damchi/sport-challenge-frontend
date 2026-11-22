import type { ChallengeCreateValues } from './schemas/challenge';

// From the creation form to the request, and back for the fields the server
// refuses. Pure functions, free of the API types.

/** A sport of the catalogue, as far as the reference and the factors go. */
export interface CatalogueSport {
  code: string;
  distance_mode: 'required' | 'none' | 'optional';
  /** Suggested factor, against the run; null for a sport without distance. */
  suggested_factor: number | null;
}

/** The sport whose distances every other is brought back to, by default. */
export const DEFAULT_REFERENCE_SPORT = 'run';

/**
 * Sports the challenge may be run in: those whose distance is required (API
 * contract, `reference_sport`). Catalogue order.
 */
export function referenceSports<S extends CatalogueSport>(sports: readonly S[]): S[] {
  return sports.filter((sport) => sport.distance_mode === 'required');
}

/**
 * Suggested factor of a sport brought back to the reference, the backend's
 * rule: min(1, factor / factor of the reference), two decimals (half up),
 * never under 0.1. The catalogue's factors are against the run. Computed in
 * hundredths, in integers, as the backend does, so the rounding is the same.
 * A reference without a positive factor counts as ×1, as in the backend
 * (`referenceFactors`): the catalogue gives one to every reference sport.
 */
export function relativeFactor(factor: number, referenceFactor: number): number {
  const hundredths = Math.round(factor * 100);
  const referenceHundredths = Math.round(referenceFactor * 100);
  const reference = referenceHundredths > 0 ? referenceHundredths : 100;
  // Half up: floor(100 f / ref + 1/2).
  const ratio = Math.floor((200 * hundredths + reference) / (2 * reference));
  return Math.min(Math.max(ratio, 10), 100) / 100;
}

/** A sport whose factor the creator may change, with its suggestion. */
export interface FactorSport {
  code: string;
  suggested: number;
}

/**
 * Sports whose factor the creator may change: those with a distance, but the
 * reference, which always counts ×1 (API contract). Catalogue order.
 */
export function factorSports(sports: readonly CatalogueSport[], reference: string): FactorSport[] {
  const referenceFactor = sports.find((sport) => sport.code === reference)?.suggested_factor ?? 1;
  return sports.flatMap(({ code, suggested_factor: factor }) =>
    factor === null || code === reference
      ? []
      : [{ code, suggested: relativeFactor(factor, referenceFactor) }],
  );
}

/**
 * The factors once the reference changes from `from` to `to`: a factor still
 * at its former suggestion, never set, or the former reference's (which had
 * no field) takes the new one; a factor the creator changed stays as they
 * set it. Only the changed entries are given.
 */
export function rebaseFactors(
  factors: Readonly<Record<string, number>>,
  sports: readonly CatalogueSport[],
  from: string,
  to: string,
): Record<string, number> {
  const before = new Map(factorSports(sports, from).map((sport) => [sport.code, sport.suggested]));
  const changes: Record<string, number> = {};
  for (const { code, suggested } of factorSports(sports, to)) {
    const current = factors[code];
    if (current === undefined || code === from || current === before.get(code)) {
      if (current !== suggested) changes[code] = suggested;
    }
  }
  return changes;
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
 * The creation request. The cumulative time is always there: only the
 * categories chosen are sent, X in meters. The factors go with the
 * cumulative distance alone, and only those the creator changed from the
 * suggestions brought back to the reference.
 */
export function challengeCreateRequest(
  values: ChallengeCreateValues,
  sports: readonly CatalogueSport[],
) {
  const suggested = new Map(
    factorSports(sports, values.reference_sport).map((sport) => [sport.code, sport.suggested]),
  );
  const changed = values.cumulative_distance
    ? Object.entries(values.factors).filter(
        ([code, factor]) => suggested.has(code) && suggested.get(code) !== factor,
      )
    : [];
  const stepKm = values.elimination_step_km;
  const categories = {
    ...(values.cumulative_distance && { cumulative_distance: {} }),
    ...(values.elimination &&
      stepKm !== undefined && { elimination: { step_meters: Math.round(stepKm * 1000) } }),
  };
  return {
    title: values.title,
    description: values.description,
    visibility: values.visibility,
    members_can_invite: values.members_can_invite,
    timezone: values.timezone,
    start_date: values.start_date,
    weeks: values.weeks,
    reference_sport: values.reference_sport,
    ...(Object.keys(categories).length > 0 && { categories }),
    ...(changed.length > 0 && { distance_factors: Object.fromEntries(changed) }),
  };
}

/**
 * The form field of a field the server refused (`params.fields` of
 * validation_failed): "categories.elimination.step_meters" is X in km,
 * "distance_factors.ride" a factor, "distance_factors" the factors as a
 * whole. Undefined for a field the form lacks.
 */
export function formFieldOf(serverField: string): string | undefined {
  if (serverField === 'categories.elimination.step_meters') return 'elimination_step_km';
  if (serverField === 'distance_factors') return 'factors';
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
    'reference_sport',
  ].includes(serverField)
    ? serverField
    : undefined;
}
