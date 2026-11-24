// What an admin change does to a ranking: the server's ranks before and
// after it, set side by side. Nothing is ranked here: the ranks, the order
// and who is out are the server's.

/** A line of a ranking, as much as a comparison needs. */
export interface RankedLine {
  rank: number | null;
  user: { id: string };
  abandoned: boolean;
  elimination: { eliminated_week: number | null } | null;
}

/**
 * How a participant's place changes: up or down so many places, the same,
 * into the ranking (added, back from an abandon or an elimination) or out
 * of it.
 */
export type Move = { kind: 'up' | 'down'; places: number } | { kind: 'same' | 'in' | 'out' };

/** A participant's line before and after the change (null: not in that ranking). */
export interface LineChange<Line extends RankedLine> {
  userId: string;
  before: Line | null;
  after: Line | null;
  /** Null when there is no ranking to compare with (a deleted challenge has none). */
  move: Move | null;
}

/** A category before and after the change (null: the challenge has not got it then). */
export interface CategoryChange<Category extends { type: string }> {
  type: Category['type'];
  before: Category | null;
  after: Category | null;
}

/**
 * Out of the ranking: abandoned, or eliminated from the elimination (as the
 * leaderboard shows it, out of the podium).
 */
export function isOut(line: RankedLine): boolean {
  return line.abandoned || (line.elimination?.eliminated_week ?? null) !== null;
}

function moveOf(before: RankedLine | null, after: RankedLine | null): Move {
  const was = before && !isOut(before) ? before.rank : null;
  const is = after && !isOut(after) ? after.rank : null;
  if (was === null && is === null) return { kind: 'same' };
  if (was === null) return { kind: 'in' };
  if (is === null) return { kind: 'out' };
  if (is < was) return { kind: 'up', places: was - is };
  if (is > was) return { kind: 'down', places: is - was };
  return { kind: 'same' };
}

/**
 * Every participant of a category, in the order of the ranking after the
 * change (the server's: ranked ones first, then the eliminated, then those
 * who abandoned), then those only in the ranking before it. Without one of
 * the two rankings, the lines of the other, with no move.
 */
export function rankingChanges<Line extends RankedLine>(
  before: readonly Line[] | null,
  after: readonly Line[] | null,
): LineChange<Line>[] {
  const comparable = before !== null && after !== null;
  const beforeById = new Map((before ?? []).map((line) => [line.user.id, line]));
  const afterIds = new Set((after ?? []).map((line) => line.user.id));
  const change = (userId: string, was: Line | null, is: Line | null): LineChange<Line> => ({
    userId,
    before: was,
    after: is,
    move: comparable ? moveOf(was, is) : null,
  });
  return [
    ...(after ?? []).map((line) =>
      change(line.user.id, beforeById.get(line.user.id) ?? null, line),
    ),
    ...(before ?? [])
      .filter((line) => !afterIds.has(line.user.id))
      .map((line) => change(line.user.id, line, null)),
  ];
}

/**
 * The categories of a challenge before and after the change, in the order of
 * those after it, then those it removes.
 */
export function categoryChanges<Category extends { type: string }>(
  before: readonly Category[] | null,
  after: readonly Category[] | null,
): CategoryChange<Category>[] {
  const afterTypes = new Set((after ?? []).map((category) => category.type));
  const find = (type: string) => before?.find((category) => category.type === type) ?? null;
  return [
    ...(after ?? []).map((category) => ({
      type: category.type,
      before: find(category.type),
      after: category,
    })),
    ...(before ?? [])
      .filter((category) => !afterTypes.has(category.type))
      .map((category) => ({ type: category.type, before: category, after: null })),
  ];
}
