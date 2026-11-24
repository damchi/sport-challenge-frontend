/** The longest search the API takes (`AdminUserSearch.q` in openapi.yaml). */
export const MAX_USER_SEARCH_LENGTH = 254;

/**
 * The search kept in the history entry of the list of accounts, checked:
 * trimmed and cut to what the API takes, absent when empty or not a text.
 * It may be an e-mail: it lives in the history state, never in the address.
 */
export function readUserSearch(state: unknown): string | undefined {
  if (typeof state !== 'object' || state === null || !('q' in state)) return undefined;
  const { q } = state;
  if (typeof q !== 'string') return undefined;
  return q.trim().slice(0, MAX_USER_SEARCH_LENGTH) || undefined;
}

/** What an account is in one of its challenges. */
export type UserChallengeRole = 'creator' | 'participant' | 'abandoned' | 'creatorAbandoned';

/**
 * The role of an account in a challenge, from what the server says: a
 * creator, a participant, or one who abandoned (or was excluded). A creator
 * who participates is a creator; one who abandoned says so.
 */
export function userChallengeRole(challenge: {
  is_creator: boolean;
  participant_status: 'active' | 'abandoned' | null;
}): UserChallengeRole {
  if (challenge.participant_status === 'abandoned') {
    return challenge.is_creator ? 'creatorAbandoned' : 'abandoned';
  }
  return challenge.is_creator ? 'creator' : 'participant';
}
