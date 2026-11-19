// Initials avatar (V1: no uploaded picture). Pure, so it can be shared with
// the mobile app.

/**
 * Up to two characters: the first letters of the first two words when the
 * second starts with a letter (jean.luc → JL), else the first two of the
 * pseudo (marie_92 → MA).
 */
export function initials(pseudo: string): string {
  const parts = pseudo
    .trim()
    .split(/[_.-]+/)
    .filter((part) => part !== '');
  const [first = '', second] = parts;
  const letters =
    second && /^[A-Za-z]/.test(second) ? `${first[0] ?? ''}${second[0]}` : first.slice(0, 2);
  return letters.toUpperCase();
}

export const AVATAR_COLORS = 6;

/** Stable colour (1 to 6) for a user: the same everywhere, never random. */
export function avatarColor(userId: string): number {
  let hash = 0;
  for (const char of userId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (hash % AVATAR_COLORS) + 1;
}
