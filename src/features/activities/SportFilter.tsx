import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActivitySummary } from '../../api/hooks/useActivities';
import { useSportName } from '../challenges/create/useSportName';

const CHIP =
  'flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-sm font-bold has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent';
const CHIP_ON = 'border-ink bg-ink text-bg';
const CHIP_OFF = 'border-border bg-surface text-ink';

/**
 * "All 6", "Run 4", "Ride 1"…: one sport at a time, in the server's order
 * and with its counts, as a group of radio buttons. `undefined` is "All".
 */
export function SportFilter({
  summary,
  selected,
  onSelect,
}: {
  summary: ActivitySummary;
  selected: string | undefined;
  onSelect: (sport: string | undefined) => void;
}) {
  const { t } = useTranslation();
  const sportName = useSportName();
  const name = useId();
  const options = [
    { code: undefined, label: t('activities.filter.all'), count: summary.total },
    ...summary.sports.map(({ sport_code, count }) => ({
      code: sport_code,
      label: sport_code === 'other' ? t('activities.otherSport') : sportName(sport_code),
      count,
    })),
  ];

  return (
    <fieldset role="radiogroup" className="min-w-0">
      <legend className="sr-only">{t('activities.filter.label')}</legend>
      {/* The padding keeps the focus ring whole inside the scrolling row; relative
          keeps the hidden radio buttons inside it too. */}
      <div className="relative -mx-5 flex gap-2 overflow-x-auto px-5 py-1 md:mx-0 md:flex-wrap md:px-0.5">
        {options.map(({ code, label, count }) => {
          const on = code === selected;
          return (
            <label key={code ?? 'all'} className={`${CHIP} ${on ? CHIP_ON : CHIP_OFF}`}>
              <input
                type="radio"
                name={name}
                className="sr-only"
                checked={on}
                onChange={() => onSelect(code)}
              />
              {label}
              <span className={`font-normal tabular-nums ${on ? 'opacity-80' : 'text-muted'}`}>
                {count}
                {/* Read as "Run 4 activities", the visible text first. */}
                <span className="sr-only"> {t('activities.filter.unit', { count })}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
