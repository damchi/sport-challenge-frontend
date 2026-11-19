// Pieces shared by the fields of the creation steps.

// No width: a field takes the whole line (w-full) or a fixed one (w-24).
export const inputClass =
  'mt-2 rounded-row border border-border bg-surface px-3 text-ink aria-[invalid=true]:border-2 aria-[invalid=true]:border-risk-fg';

/** Hint first, then the error once there is one. */
export function describedBy(name: string, message: string | undefined): string {
  return message ? `${name}-hint ${name}-error` : `${name}-hint`;
}
