// Free text rules shared by the schemas: what the server refuses and how it
// counts. Lengths count characters (code points), as the server does, not
// UTF-16 units.

// Line breaks, the line and paragraph separators included, and tabs: what a
// text on several lines (a description, an admin reason) may hold.
export const LINE_BREAKS_AND_TAB = new Set(['\n', '\r', '\t', '\u2028', '\u2029']);

// Formatting characters (Unicode Cf) the contract keeps: joiners, direction
// marks and the tags of flags.
function isKeptFormat(codePoint: number): boolean {
  return (
    (codePoint >= 0x200c && codePoint <= 0x200f) || (codePoint >= 0xe0020 && codePoint <= 0xe007f)
  );
}

function isRefused(char: string, allowed: ReadonlySet<string>): boolean {
  if (allowed.has(char)) {
    return false;
  }
  if (char === '\u2028' || char === '\u2029' || /\p{Cc}/u.test(char)) {
    return true;
  }
  // `codePointAt(0)` is defined: `char` is one code point of a string.
  return /\p{Cf}/u.test(char) && !isKeptFormat(char.codePointAt(0) ?? 0);
}

export function hasOnlyAllowedCharacters(text: string, allowed: ReadonlySet<string>): boolean {
  return [...text].every((char) => !isRefused(char, allowed));
}

// Number of characters as the server counts them (code points).
export function characterCount(text: string): number {
  return [...text].length;
}

// The kept formatting characters are invisible: they do not count as visible.
export function visibleCount(text: string): number {
  return [...text].filter((char) => !/\p{Cf}/u.test(char)).length;
}
