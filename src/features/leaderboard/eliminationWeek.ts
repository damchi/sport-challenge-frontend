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

/** What the elimination counts: meters of the reference sport, or repetitions of an exercise. */
export type EliminationUnit = 'meters' | 'repetitions';

/** The amount done in the week, in the server's unit. */
interface WeekAmount {
  unit: EliminationUnit;
  done: number;
}

/**
 * The figures of a participant's week: in repetitions when the server gives
 * them (an elimination by repetitions), else in meters.
 */
export function weekFigures(progress: Progress): WeekAmount & { minimum: number | null } {
  const { repetitions, minimum_repetitions: minimum = null } = progress;
  if (repetitions !== undefined) return { unit: 'repetitions', done: repetitions, minimum };
  return { unit: 'meters', done: progress.distance_meters, minimum: progress.minimum_meters };
}

/** Share of the week's minimum done, from 0 to 1 (a minimum of 0 is met). */
export function minimumShare(progress: Progress): number {
  const { done, minimum } = weekFigures(progress);
  if (minimum === null) return 0;
  return minimum === 0 ? 1 : Math.min(done / minimum, 1);
}

/** What a line of the elimination says of the user's week, read from the server's values. */
export type EliminationLine =
  /** Out of the ranking since that week. */
  | { kind: 'eliminated'; week: number }
  /** A survivor's week against its minimum: status, amounts and the bar's share. */
  | (WeekAmount & { kind: 'live'; status: LiveStatus; minimum: number; share: number })
  /** No minimum (week 1): the amount of the week alone. */
  | (WeekAmount & { kind: 'distance' });

/**
 * The line of the elimination for a participant: eliminated (the server's
 * eliminated_week), a live week (a status and a minimum), else the amount
 * of the week, the minimum being null in week 1. In meters or repetitions,
 * as the server gives them.
 */
export function eliminationLine(progress: Progress): EliminationLine {
  if (progress.eliminated_week !== null) {
    return { kind: 'eliminated', week: progress.eliminated_week };
  }
  const status = progress.status;
  const { unit, done, minimum } = weekFigures(progress);
  if (status && status !== 'eliminated' && minimum !== null) {
    return { kind: 'live', status, unit, done, minimum, share: minimumShare(progress) };
  }
  return { kind: 'distance', unit, done };
}
