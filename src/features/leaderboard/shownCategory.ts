import type { ChallengeDetail, Leaderboard, LeaderboardEntry } from '../../api/hooks/useChallenges';

type CategoryRanking = Leaderboard['categories'][number];

/**
 * The category the leaderboard shows: the one of the address (?category=)
 * when the challenge has it, else the first one.
 */
export function shownCategory(
  categories: readonly CategoryRanking[],
  asked: string | null,
): CategoryRanking | undefined {
  return categories.find((category) => category.type === asked) ?? categories[0];
}

/**
 * Whether the page shows « Où tu en es »: to an active participant (the
 * server's my_status) of a challenge started (the server's status). Its
 * cards then choose the leaderboard's category.
 */
export function hasStandings(challenge: ChallengeDetail): boolean {
  return challenge.my_status === 'active' && challenge.status !== 'upcoming';
}

/** The user's line in each category that has one, in the categories' order. */
export function myLines(
  categories: readonly CategoryRanking[],
  myId: string | undefined,
): { category: CategoryRanking; entry: LeaderboardEntry }[] {
  return categories.flatMap((category) => {
    const entry = category.entries.find((candidate) => candidate.user.id === myId);
    return entry ? [{ category, entry }] : [];
  });
}
