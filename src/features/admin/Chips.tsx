export const CHIP = 'flex h-11 shrink-0 items-center rounded-full border px-4 text-sm font-bold';
export const CHIP_ON = 'border-accent bg-accent-soft text-accent';
export const CHIP_OFF = 'border-border bg-surface text-muted hover-border';

/** A row of filter chips, one of them chosen (`aria-pressed`). */
export function Chips<T extends string>({
  label,
  options,
  selected,
  onSelect,
  name,
}: {
  label: string;
  options: readonly (T | undefined)[];
  selected: T | undefined;
  onSelect: (value: T | undefined) => void;
  name: (value: T | undefined) => string;
}) {
  return (
    // The padding keeps the focus ring whole inside the scrolling row.
    <div
      role="group"
      aria-label={label}
      className="-mx-5 flex min-w-0 gap-2 overflow-x-auto px-5 py-1 md:mx-0 md:px-0.5"
    >
      {options.map((value) => (
        <button
          key={value ?? 'all'}
          type="button"
          aria-pressed={selected === value}
          onClick={() => onSelect(value)}
          className={`${CHIP} ${selected === value ? CHIP_ON : CHIP_OFF}`}
        >
          {name(value)}
        </button>
      ))}
    </div>
  );
}
