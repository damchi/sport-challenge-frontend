import { isChallengeStatus, type ChallengeStatus } from './challenge';

export type ChallengeVisibility = 'public' | 'private';
export const CHALLENGE_VISIBILITIES: readonly ChallengeVisibility[] = ['public', 'private'];

/** The filters of the admin list of challenges, as the API takes them. */
export interface AdminChallengeFilters {
  /** Part of the title, trimmed; absent for every title. */
  q?: string;
  status?: ChallengeStatus;
  visibility?: ChallengeVisibility;
  /** The deleted challenges only; absent for every challenge, deleted or not. */
  deleted?: true;
}

/** The longest search the API takes (`q` in openapi.yaml). */
export const MAX_SEARCH_LENGTH = 80;

function isVisibility(value: unknown): value is ChallengeVisibility {
  return CHALLENGE_VISIBILITIES.includes(value as ChallengeVisibility);
}

/**
 * The filters an address holds (?q=&status=&visibility=&deleted=), each
 * checked: a value the API would refuse is left out.
 */
export function readAdminChallengeFilters(params: URLSearchParams): AdminChallengeFilters {
  const q = params.get('q')?.trim().slice(0, MAX_SEARCH_LENGTH);
  const status = params.get('status');
  const visibility = params.get('visibility');
  return {
    ...(q && { q }),
    ...(isChallengeStatus(status) && { status }),
    ...(isVisibility(visibility) && { visibility }),
    ...(params.get('deleted') === 'true' && { deleted: true as const }),
  };
}
