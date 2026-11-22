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
