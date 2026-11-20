// Ranks of a leaderboard as ordinals of the language: 1er, 2e / 1st, 2nd.

const ENGLISH_SUFFIXES: Record<string, string> = { one: 'st', two: 'nd', few: 'rd', other: 'th' };

/** A rank as an ordinal: "1er", "2e" in French, "1st", "22nd", "13th" otherwise. */
export function formatRank(rank: number, locale: string): string {
  if (locale.startsWith('fr')) return rank === 1 ? '1er' : `${rank}e`;
  const category = new Intl.PluralRules('en', { type: 'ordinal' }).select(rank);
  return `${rank}${ENGLISH_SUFFIXES[category] ?? 'th'}`;
}

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
