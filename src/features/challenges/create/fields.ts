// Pieces shared by the fields of the creation steps.

// No width: a field takes the whole line (w-full) or a fixed one (w-24).
export const inputClass =
  'mt-2 rounded-row border border-border bg-surface px-4 text-ink aria-[invalid=true]:border-2 aria-[invalid=true]:border-risk-fg';

// A choice drawn as a card (a radio and its text): accent once chosen, the
// ring adding the second pixel without moving the content.
export const choiceCardClass =
  'flex min-h-11 cursor-pointer items-start gap-3 rounded-row border border-border bg-surface p-4 has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:ring-1 has-[:checked]:ring-accent';

/** Hint first, then the error once there is one. */
export function describedBy(name: string, message: string | undefined): string {
  return message ? `${name}-hint ${name}-error` : `${name}-hint`;
}
