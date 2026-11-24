import { useId, type ReactNode } from 'react';

/**
 * A table of the admin section (design.md): in a card that scrolls sideways
 * on a phone, focusable so that the keyboard scrolls it too, named by its
 * caption (read only by screen readers: the heading above says it).
 */
export function AdminTable({
  caption,
  columns,
  children,
}: {
  caption: string;
  columns: string[];
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div
      role="region"
      aria-labelledby={id}
      tabIndex={0}
      className="overflow-x-auto rounded-card border border-border bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <table className="w-full min-w-120 text-sm">
        <caption id={id} className="sr-only">
          {caption}
        </caption>
        <thead>
          <tr className="text-muted">
            {columns.map((column) => (
              <th key={column} scope="col" className="px-4 py-3 text-left font-semibold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
