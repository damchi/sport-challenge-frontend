import type { components } from '../api/generated/schema';

type Leaderboard = components['schemas']['Leaderboard'];
type CategoryRanking = Leaderboard['categories'][number];

/** A category's whole ranking, as the mocks and tests write it. */
export type FullRanking = Pick<CategoryRanking, 'type' | 'ranked_count' | 'entries'>;

/**
 * The leaderboard as the API answers `query` (openapi.yaml): without `limit`,
 * every category whole; with it, each category's podium (ranks 1 to 3 with a
 * value above 0, ties included), then `limit` lines after it and the cursor of
 * the rest (here the index of the next line); `category` answers that one
 * alone. `me` is the line of `myId`, wherever it is.
 */
export function answerLeaderboard(
  computedAt: string,
  categories: readonly FullRanking[],
  query: URLSearchParams,
  myId: string,
): Leaderboard {
  const asked = query.get('category');
  const limit = query.get('limit');
  const from = Number(query.get('cursor') ?? 0);
  const shown = asked ? categories.filter((category) => category.type === asked) : categories;
  return {
    computed_at: computedAt,
    categories: shown.map((category) => {
      const me = category.entries.find((entry) => entry.user.id === myId) ?? null;
      if (limit === null) return { ...category, podium: null, me, next_cursor: null };
      const onPodium = (entry: CategoryRanking['entries'][number]) =>
        !entry.abandoned && entry.rank !== null && entry.rank <= 3 && (entry.value ?? 0) > 0;
      const after = category.entries.filter((entry) => !onPodium(entry));
      const to = from + Number(limit);
      return {
        ...category,
        podium: category.entries.filter(onPodium),
        entries: after.slice(from, to),
        me,
        next_cursor: to < after.length ? String(to) : null,
      };
    }),
  };
}
