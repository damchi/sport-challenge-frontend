import type { ReactNode } from 'react';

/**
 * A part of an admin sheet, under its heading, with its button beside it if
 * any. Not a named region: its table, if any, is one already, under the same
 * name.
 */
export function SheetPart({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const heading = <h3 className="font-display text-lg font-bold">{title}</h3>;
  return (
    <section className="flex flex-col gap-3">
      {action ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {heading}
          {action}
        </div>
      ) : (
        heading
      )}
      {children}
    </section>
  );
}
