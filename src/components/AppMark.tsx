import { Trophy } from 'lucide-react';

/** The app's mark: a trophy on the accent colour. Decorative: the app name is written next to it. */
export function AppMark() {
  return (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-tab bg-accent text-on-accent"
    >
      <Trophy size={18} strokeWidth={2} />
    </span>
  );
}
