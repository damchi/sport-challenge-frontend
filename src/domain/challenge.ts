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

// An id of the API (challenge, user): a UUID (any version), in lower or upper case.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether an address parameter can be a challenge id, checked before any request. */
export function isChallengeId(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

/**
 * Challenge ids of a comma-separated server parameter (`last_creator`'s
 * `challenges`): only valid ids, each once.
 */
export function challengeIdList(value: string | undefined): string[] {
  const ids = (value ?? '').split(',').map((id) => id.trim());
  return [...new Set(ids.filter(isChallengeId))];
}

/** Whether an address parameter can be a user id, checked before any request. */
export function isUserId(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

/**
 * The user's role in a challenge, as the server gives it (my_role); the
 * contract's enum is the reference (src/domain does not import src/api).
 */
export type ChallengeRole = 'creator' | 'participant' | 'abandoned' | 'invited' | 'outsider';

/**
 * Whether the user may open the activities of a participant: the creators and
 * the participants, abandoned ones included, as the contract says
 * (listParticipantActivities); anyone else gets a 404 there.
 */
export function canSeeParticipantActivities(role: ChallengeRole): boolean {
  return role === 'creator' || role === 'participant' || role === 'abandoned';
}
