// Ranks of a leaderboard, as the server gives them. Their ordinals (1er,
// 1st) are translations: leaderboard.rank_ordinal_* in src/i18n.

/** Ranks held by more than one participant (ties: 1, 1, 3). */
export function sharedRanks(ranks: readonly (number | null)[]): Set<number> {
  const seen = new Set<number>();
  const shared = new Set<number>();
  for (const rank of ranks) {
    if (rank === null) continue;
    if (seen.has(rank)) shared.add(rank);
    seen.add(rank);
  }
  return shared;
}
