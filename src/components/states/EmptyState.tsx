import type { ReactNode } from 'react';

/** Nothing to show yet: a sentence saying what to do, and the screen's main action. */
export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-border-dashed p-6 text-center">
      <p className="text-muted">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
