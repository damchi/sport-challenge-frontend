// Challenge types of the domain, shared with the mobile app in V2.

/** Which challenges a list shows: those I created or joined (the default), or the public ones. */
export type ChallengeScope = 'public' | 'mine';
export const CHALLENGE_SCOPES: readonly ChallengeScope[] = ['mine', 'public'];

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
 * Whether the user may open the activities of a participant, or of all of
 * them: the creators and the participants, abandoned ones included, as the
 * contract says (listParticipantActivities, listChallengeActivities); anyone
 * else gets a 404 there.
 */
export function canSeeParticipantActivities(role: ChallengeRole): boolean {
  return role === 'creator' || role === 'participant' || role === 'abandoned';
}

/** An action of the challenge page's menu. */
export type ChallengeAction = 'edit' | 'delete' | 'abandon';

/**
 * The actions of the user's role in a challenge, read from the server's
 * my_role, my_status and status: a creator edits and deletes; an active
 * participant (creator included) abandons a challenge not finished yet
 * (decision of 2026-11-20: the contract has no can_abandon).
 */
export function challengeActions(challenge: {
  my_role: ChallengeRole;
  my_status: 'active' | 'abandoned' | null;
  status: ChallengeStatus;
}): ChallengeAction[] {
  const actions: ChallengeAction[] = [];
  if (challenge.my_role === 'creator') actions.push('edit', 'delete');
  if (challenge.my_status === 'active' && challenge.status !== 'finished') actions.push('abandon');
  return actions;
}

/** Distance factors by sport code, as the contract gives them. */
export type DistanceFactors = Record<string, number>;

/**
 * The distance factors a challenge shows: those of its total distance, else
 * those of its points when a criterion uses them (the longest session by
 * distance), else none.
 */
export function shownFactors(
  categories: readonly {
    type: string;
    params: { factors?: DistanceFactors; criteria?: readonly string[] };
  }[],
): DistanceFactors | undefined {
  const distance = categories.find((category) => category.type === 'cumulative_distance');
  if (distance) return distance.params.factors;
  const points = categories.find((category) => category.type === 'points')?.params;
  return points?.criteria?.includes('longest_distance') ? points.factors : undefined;
}
