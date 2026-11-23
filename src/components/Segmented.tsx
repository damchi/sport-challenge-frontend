import { useId } from 'react';

const SEGMENT =
  'flex h-11 flex-1 cursor-pointer items-center justify-center rounded-tab px-2 text-sm font-semibold has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent';
const SEGMENT_ON = 'bg-segment-active text-ink shadow-[0_1px_3px_rgba(22,24,29,.12)]';
const SEGMENT_OFF = 'text-muted hover-ink';

/**
 * A choice among a few options, as a segmented control of radio buttons
 * (design.md): its legend above it, or beside it when `inline`.
 */
export function Segmented<T extends string>({
  legend,
  options,
  selected,
  onSelect,
  label,
  lang,
  inline = false,
}: {
  legend: string;
  options: readonly T[];
  selected: string | undefined;
  onSelect: (value: T) => void;
  label: (value: T) => string;
  lang?: (value: T) => string;
  inline?: boolean;
}) {
  const name = useId();
  return (
    // A floated legend is laid out as a flex item, beside the options; they
    // go under it when the text is enlarged.
    <fieldset className={inline ? 'flex flex-wrap items-center gap-x-3 gap-y-2' : undefined}>
      <legend className={`text-sm font-semibold ${inline ? 'float-left shrink-0' : ''}`}>
        {legend}
      </legend>
      <div
        className={`relative flex rounded-row bg-segment p-1 ${inline ? 'min-w-0 grow basis-44' : 'mt-2'}`}
      >
        {options.map((value) => {
          const on = value === selected;
          return (
            <label key={value} className={`${SEGMENT} ${on ? SEGMENT_ON : SEGMENT_OFF}`}>
              <input
                type="radio"
                name={name}
                value={value}
                checked={on}
                onChange={() => onSelect(value)}
                className="sr-only"
              />
              <span lang={lang?.(value)}>{label(value)}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
