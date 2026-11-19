// Challenge types of the domain, shared with the mobile app in V2.

/** Which challenges a list shows: the public ones, or those I created or joined. */
export type ChallengeScope = 'public' | 'mine';
export const CHALLENGE_SCOPES: readonly ChallengeScope[] = ['public', 'mine'];

/** Status filter of a list; the server computes each challenge's status. */
export type ChallengeStatus = 'upcoming' | 'ongoing' | 'finished';
export const CHALLENGE_STATUSES: readonly ChallengeStatus[] = ['upcoming', 'ongoing', 'finished'];

export function isChallengeScope(value: unknown): value is ChallengeScope {
  return CHALLENGE_SCOPES.includes(value as ChallengeScope);
}

export function isChallengeStatus(value: unknown): value is ChallengeStatus {
  return CHALLENGE_STATUSES.includes(value as ChallengeStatus);
}
