// Time zone of an activity's start: an activity belongs to no challenge, but
// its start is read in the time zone of the user's ongoing challenges, where
// it counts; in the device's when they have none or disagree (owner's
// decisions, 2026-11-20). The server then counts it in every ongoing
// challenge whose window holds it.

/** A challenge of the user, as far as the time zone of an entry goes. */
export interface ZonedChallenge {
  timezone: string;
  my_status: 'active' | 'abandoned' | null;
}

/**
 * Time zone the start is read in: the one of the ongoing challenges where
 * the user takes part when they share it; the device's otherwise (none, or
 * several zones).
 */
export function activityTimeZone(
  ongoing: readonly ZonedChallenge[],
  deviceTimeZone: string,
): string {
  const zones = new Set(
    ongoing
      .filter((challenge) => challenge.my_status === 'active')
      .map((challenge) => challenge.timezone),
  );
  const [only] = zones;
  return zones.size === 1 && only !== undefined ? only : deviceTimeZone;
}

// An activity id of the API: a UUID (any version), in lower or upper case.
const ACTIVITY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether an address parameter can be an activity id, checked before any request. */
export function isActivityId(value: unknown): value is string {
  return typeof value === 'string' && ACTIVITY_ID.test(value);
}

// A sport code of the catalogue, as the API accepts it in a filter.
const SPORT_CODE = /^[a-z][a-z0-9_]{0,31}$/;

/** Whether an address parameter can be a sport code, checked before any request. */
export function isSportCode(value: unknown): value is string {
  return typeof value === 'string' && SPORT_CODE.test(value);
}

// Sports in the order an entry offers them (mockups AjoutActivite and
// WebAjoutActivite, owner's decision of 2026-11-22).
const ENTRY_ORDER = [
  'run',
  'ride',
  'walk',
  'hike',
  'swim',
  'rowing',
  'roller',
  'xc_ski',
  'yoga',
  'climbing',
  'strength',
];

/**
 * The catalogue as an entry offers it: the sports of the mockups in their
 * order, then any other sport of the catalogue by its `name` in `locale`,
 * "other" last.
 */
export function sortSportsForEntry<S extends { code: string }>(
  sports: readonly S[],
  name: (code: string) => string,
  locale: string,
): S[] {
  const rank = (sport: S) => {
    if (sport.code === 'other') return ENTRY_ORDER.length + 1;
    const index = ENTRY_ORDER.indexOf(sport.code);
    return index === -1 ? ENTRY_ORDER.length : index;
  };
  return [...sports].sort(
    (a, b) => rank(a) - rank(b) || name(a.code).localeCompare(name(b.code), locale),
  );
}
