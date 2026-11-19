import type { ReactNode } from 'react';

/**
 * Page container: full width on a phone (20 px margins), 720 px at most on a
 * tablet, 1120 px from `lg` (32 px margins), as in design.md.
 */
export function Page({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-page px-5 py-8 lg:max-w-wide lg:px-8">{children}</main>
  );
}

/** Page title (h1): 28 px, 36 px from `lg`. */
export function PageTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="font-display text-title font-bold tracking-title lg:text-title-lg">
      {children}
    </h1>
  );
}
