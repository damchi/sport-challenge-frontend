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
