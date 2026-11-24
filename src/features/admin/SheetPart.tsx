import type { ReactNode } from 'react';

/**
 * A part of an admin sheet, under its heading. Not a named region: its table,
 * if any, is one already, under the same name.
 */
export function SheetPart({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-display text-lg font-bold">{title}</h3>
      {children}
    </section>
  );
}
