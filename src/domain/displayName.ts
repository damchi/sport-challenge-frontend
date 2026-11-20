// Name of a user as others see it: the pseudo when there is one, else the
// first and last name. The e-mail is never part of it.

export interface NamedUser {
  pseudo: string | null;
  first_name: string | null;
  last_name: string | null;
}

/** "marie_92", else "Marie Tremblay"; null when the user has neither. */
export function displayName({ pseudo, first_name, last_name }: NamedUser): string | null {
  const shown = pseudo?.trim() || [first_name, last_name].filter(Boolean).join(' ').trim();
  return shown === '' ? null : shown;
}
