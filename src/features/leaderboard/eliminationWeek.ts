import type { LeaderboardEntry } from '../../api/hooks/useChallenges';

export type Progress = NonNullable<LeaderboardEntry['elimination']>;
/** A survivor's status of the week, the server's. */
export type LiveStatus = Exclude<NonNullable<Progress['status']>, 'eliminated'>;

/** The bar's colour for each status of the week (design.md). */
export const STATUS_BARS: Record<LiveStatus, string> = {
  reached: 'bg-ok-bar',
  at_risk: 'bg-risk-bar',
  in_progress: 'bg-rank-bar',
};

/** Share of the week's minimum done, from 0 to 1 (a minimum of 0 is met). */
export function minimumShare(progress: Progress): number {
  const minimum = progress.minimum_meters;
  if (minimum === null) return 0;
  return minimum === 0 ? 1 : Math.min(progress.distance_meters / minimum, 1);
}

/** What a line of the elimination says of the user's week, read from the server's values. */
export type EliminationLine =
  /** Out of the ranking since that week. */
  | { kind: 'eliminated'; week: number }
  /** A survivor's week against its minimum: status, distances and the bar's share. */
  | { kind: 'live'; status: LiveStatus; done: number; minimum: number; share: number }
  /** No minimum (week 1): the distance of the week alone. */
  | { kind: 'distance'; done: number };

/**
 * The line of the elimination for a participant: eliminated (the server's
 * eliminated_week), a live week (a status and a minimum), else the distance
 * of the week, the minimum being null in week 1.
 */
export function eliminationLine(progress: Progress): EliminationLine {
  if (progress.eliminated_week !== null) {
    return { kind: 'eliminated', week: progress.eliminated_week };
  }
  const status = progress.status;
  if (status && status !== 'eliminated' && progress.minimum_meters !== null) {
    return {
      kind: 'live',
      status,
      done: progress.distance_meters,
      minimum: progress.minimum_meters,
      share: minimumShare(progress),
    };
  }
  return { kind: 'distance', done: progress.distance_meters };
}
