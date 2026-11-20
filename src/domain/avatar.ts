// Initials avatar (V1: no uploaded picture). Pure, so it can be shared with
// the mobile app.

import type { NamedUser } from './displayName';

/**
 * Up to two characters of the name shown (pseudo, else first and last name):
 * the first letters of the first two words when the second starts with a
 * letter, else the first two of the name (marie_92 → MA). Words are split by
 * spaces (Marie-Ève Tremblay → MT), else by _ . - (jean.luc → JL).
 */
export function initials(name: string): string {
  const split = (separator: RegExp) =>
    name
      .trim()
      .split(separator)
      .filter((part) => part !== '');
  const words = split(/\s+/u);
  const parts = words.length > 1 ? words : split(/[_.-]+/);
  const [first = '', second] = parts;
  const letters =
    second && /^\p{L}/u.test(second)
      ? `${[...first][0] ?? ''}${[...second][0]}`
      : [...first].slice(0, 2).join('');
  // Not locale-aware: the same initials on every device, never more than two.
  return [...letters.toUpperCase()].slice(0, 2).join('');
}

const firstLetter = (name: string | null) => [...(name ?? '').trim()][0] ?? '';

/**
 * Initials of a user, from the name shown: the pseudo's when there is one
 * (marie_92 → MA), else the first letter of the first name and of the last
 * name (Damien Paul-Louis Raffi → DR); empty without any name.
 */
export function avatarInitials({ pseudo, first_name, last_name }: NamedUser): string {
  if (pseudo?.trim()) return initials(pseudo);
  return `${firstLetter(first_name)}${firstLetter(last_name)}`.toUpperCase();
}

export const AVATAR_COLORS = 6;

/** Stable colour (1 to 6) for a user: the same everywhere, never random. */
export function avatarColor(userId: string): number {
  let hash = 0;
  for (const char of userId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (hash % AVATAR_COLORS) + 1;
}
