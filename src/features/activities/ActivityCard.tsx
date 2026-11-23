import { PenLine } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { Activity } from '../../api/hooks/useActivities';
import { StatusPill } from '../../components/StatusPill';
import { activityTime } from '../../domain/format/challengeDates';
import { formatKm, formatSpeed } from '../../domain/format/distance';
import { formatActivityDuration, formatPace } from '../../domain/format/duration';
import { useSportName } from '../challenges/create/useSportName';

/**
 * An activity, read only: sport (marked "manual" when entered by hand),
 * start in `timeZone`, duration, distance, and the pace and speed the API
 * computes.
 */
export function ActivityCard({ activity, timeZone }: { activity: Activity; timeZone: string }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const sportName = useSportName();
  const titleId = useId();
  const sport =
    activity.sport_code === 'other'
      ? (activity.sport_label ?? t('activities.otherSport'))
      : sportName(activity.sport_code);

  return (
    <article aria-labelledby={titleId} className="rounded-card border border-border bg-surface p-4">
      {/* The pill sits beside the sport, under it when the text is enlarged. */}
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <h2
          id={titleId}
          className="min-w-0 flex-1 basis-24 font-display text-lg font-bold break-words"
        >
          {sport}
        </h2>
        {activity.source === 'manual' && (
          <StatusPill label={t('activities.manual')} Icon={PenLine} tone="neutral" />
        )}
      </div>
      <p className="mt-1 text-sm text-muted">
        <time dateTime={activity.started_at}>
          {activityTime(activity.started_at, timeZone, locale)}
        </time>
      </p>
      <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <div className="flex gap-1">
          <dt className="text-muted">{t('activities.duration')}</dt>
          <dd className="font-semibold tabular-nums">
            {formatActivityDuration(activity.duration_seconds)}
          </dd>
        </div>
        {activity.distance_meters !== null && (
          <div className="flex gap-1">
            <dt className="text-muted">{t('activities.distance')}</dt>
            <dd className="font-semibold tabular-nums">
              {formatKm(activity.distance_meters / 1000, locale)}
            </dd>
          </div>
        )}
        {activity.pace_seconds_per_km !== null && (
          <div className="flex gap-1">
            <dt className="text-muted">{t('activities.pace')}</dt>
            <dd className="font-semibold tabular-nums">
              {t('activities.paceValue', { pace: formatPace(activity.pace_seconds_per_km) })}
            </dd>
          </div>
        )}
        {activity.speed_mps !== null && (
          <div className="flex gap-1">
            <dt className="text-muted">{t('activities.speed')}</dt>
            <dd className="font-semibold tabular-nums">
              {formatSpeed(activity.speed_mps, locale)}
            </dd>
          </div>
        )}
      </dl>
    </article>
  );
}
