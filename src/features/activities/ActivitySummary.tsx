import { useWatch, type Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { activityStart } from '../../domain/format/challengeDates';
import { formatEnteredKm } from '../../domain/format/distance';
import { formatActivityDuration } from '../../domain/format/duration';
import {
  activityDraft,
  cleanSportLabel,
  type ActivityCreateInput,
  type ActivityCreateValues,
} from '../../domain/schemas/activity';
import { useSportName } from '../challenges/create/useSportName';

/**
 * The entry so far, each line once it reads as a value: sport, start (in
 * `timeZone`), duration, distance (for a sport with km). No pace nor speed:
 * the API computes them once recorded (owner's decision of 2026-11-22).
 * Beside the form (from `lg`), it also says what happens next.
 */
export function ActivitySummary({
  control,
  timeZone,
  hasDistance,
}: {
  control: Control<ActivityCreateInput, unknown, ActivityCreateValues>;
  timeZone: string;
  hasDistance: boolean;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const sportName = useSportName();
  const input = useWatch({ control });
  const draft = activityDraft(
    {
      sport_code: input.sport_code ?? '',
      sport_label: input.sport_label ?? '',
      start_date: input.start_date ?? '',
      start_time: input.start_time ?? '',
      hours: input.hours ?? '',
      minutes: input.minutes ?? '',
      seconds: input.seconds ?? '',
      distance_km: input.distance_km ?? '',
      elevation_m: input.elevation_m ?? '',
    },
    timeZone,
  );
  const label = cleanSportLabel(input.sport_label ?? '');
  const sport =
    input.sport_code === 'other' && label !== ''
      ? label
      : input.sport_code
        ? sportName(input.sport_code)
        : undefined;
  const rows = [
    ...(sport ? [{ key: 'sport', value: sport }] : []),
    ...(draft.start ? [{ key: 'start', value: activityStart(draft.start, timeZone, locale) }] : []),
    ...(draft.durationSeconds !== undefined
      ? [{ key: 'duration', value: formatActivityDuration(draft.durationSeconds) }]
      : []),
    ...(hasDistance && draft.distanceMeters !== undefined
      ? [{ key: 'distance', value: formatEnteredKm(draft.distanceMeters / 1000, locale) }]
      : []),
  ] as const;

  return (
    <section
      aria-labelledby="activity-summary-title"
      className="rounded-card border border-border bg-surface p-5 lg:p-6"
    >
      <h2 id="activity-summary-title" className="font-display text-xl font-bold">
        {t('activityForm.summary.title')}
      </h2>
      {rows.length > 0 ? (
        <dl className="mt-3 border-t border-border">
          {rows.map(({ key, value }) => (
            <div
              key={key}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border py-3"
            >
              <dt className="text-muted">{t(`activityForm.summary.${key}`)}</dt>
              <dd className="ml-auto text-right font-bold break-words tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 text-muted">{t('activityForm.summary.empty')}</p>
      )}
      <p className="mt-4 hidden text-muted lg:block">{t('activityForm.summary.note')}</p>
    </section>
  );
}
