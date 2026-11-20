// Time zone of an activity's start: an activity belongs to no challenge, but
// its start is read in the time zone of the user's ongoing challenges, where
// it counts (owner's decision, 2026-11-20).

/** A challenge of the user, as far as the time zone of an entry goes. */
export interface ZonedChallenge {
  timezone: string;
  my_status: 'active' | 'abandoned' | null;
}

/**
 * Time zones the start may be read in: those of the ongoing challenges where
 * the user takes part, first seen first; the device's when there is none.
 * Several zones are offered to choose from.
 */
export function activityTimeZones(
  ongoing: readonly ZonedChallenge[],
  deviceTimeZone: string,
): string[] {
  const zones = [
    ...new Set(
      ongoing
        .filter((challenge) => challenge.my_status === 'active')
        .map((challenge) => challenge.timezone),
    ),
  ];
  return zones.length > 0 ? zones : [deviceTimeZone];
}
