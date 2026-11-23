import { Lock, PenLine } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, errorMessage } from '../../api/errors';
import { useDeleteActivity, type Activity } from '../../api/hooks/useActivities';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { StatusPill } from '../../components/StatusPill';
import { dayKind } from '../../domain/activityWeeks';
import { activityClock, activityDay } from '../../domain/format/activityDates';
import { formatKm, formatSpeed } from '../../domain/format/distance';
import { formatActivityDuration, formatPace } from '../../domain/format/duration';
import { useSportName } from '../challenges/create/useSportName';
import { ActivityMenu } from './ActivityMenu';
import { ElevationGain } from './ElevationGain';
import { SportIcon } from './SportIcon';

/**
 * An activity of the user, one row of its week: sport (marked "manual"), its
 * start in `timeZone` ("today", "yesterday" seen at `now`), the challenges
 * where it counts, its duration, distance, and the pace and speed the API
 * computes. While the server says it is not `locked`, a "…" menu changes or
 * deletes it (deleting asks first, then `onDeleted` is told); a locked one
 * says its week is judged.
 */
export function ActivityItem({
  activity,
  timeZone,
  now,
  onDeleted,
}: {
  activity: Activity;
  timeZone: string;
  now: Date;
  onDeleted: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const sportName = useSportName();
  const deleteActivity = useDeleteActivity();
  const [confirming, setConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();
  const menuButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const startId = useId();

  // A failed deletion gives the focus back to the menu once it is enabled
  // again (after the render that ends the request).
  useEffect(() => {
    if (deleteError) menuButton.current?.focus();
  }, [deleteError]);

  const sport =
    activity.sport_code === 'other'
      ? (activity.sport_label ?? t('activities.otherSport'))
      : sportName(activity.sport_code);
  const time = activityClock(activity.started_at, timeZone, locale);
  const day = dayKind(activity.started_at, now, timeZone);
  const start =
    day === 'other'
      ? t('activities.startAt', { day: activityDay(activity.started_at, timeZone, locale), time })
      : t(`activities.${day}`, { time });
  const challenges = activity.contributions.map(({ challenge_title }) => challenge_title);

  const remove = async () => {
    setConfirming(false);
    setDeleteError(undefined);
    try {
      await deleteActivity.mutateAsync(activity.id);
      onDeleted();
    } catch (error) {
      // Already gone (deleted elsewhere): what was asked is done.
      if (error instanceof ApiError && error.status === 404) {
        onDeleted();
        return;
      }
      const { key, values } =
        error instanceof ApiError
          ? error.code === 'week_locked'
            ? { key: 'activities.lockedRefused', values: {} }
            : errorMessage(error, (candidate) => i18n.exists(candidate))
          : { key: 'errors.unknown', values: {} };
      setDeleteError(t(key, values));
    }
  };

  const stats = [
    { key: 'duration', value: formatActivityDuration(activity.duration_seconds) },
    {
      key: 'distance',
      value:
        activity.distance_meters === null ? (
          <>
            <span aria-hidden="true">—</span>
            <span className="sr-only">{t('activities.noDistance')}</span>
          </>
        ) : (
          formatKm(activity.distance_meters / 1000, locale)
        ),
    },
    ...(activity.pace_seconds_per_km !== null
      ? [
          {
            key: 'pace',
            value: t('activities.paceValue', { pace: formatPace(activity.pace_seconds_per_km) }),
          },
        ]
      : []),
    ...(activity.speed_mps !== null
      ? [{ key: 'speed', value: formatSpeed(activity.speed_mps, locale) }]
      : []),
    // Last, so that the other stats keep their columns without it.
    ...(activity.elevation_gain_meters !== null
      ? [{ key: 'elevation', value: <ElevationGain meters={activity.elevation_gain_meters} /> }]
      : []),
  ];

  return (
    // The action drops below when enlarged text leaves the details too narrow.
    <article
      aria-labelledby={titleId}
      className="flex flex-wrap gap-3 p-4 lg:flex-nowrap lg:items-center lg:gap-5 lg:px-6"
    >
      <SportIcon code={activity.sport_code} />
      <div className="min-w-0 flex-1 basis-[140px] lg:flex lg:flex-wrap lg:items-center lg:gap-x-6 lg:gap-y-3">
        <div className="min-w-0 lg:flex-1 lg:basis-36">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 id={titleId} className="font-display text-lg font-bold break-words">
              {sport}
            </h3>
            {activity.source === 'manual' && (
              <StatusPill label={t('activities.manual')} Icon={PenLine} tone="neutral" />
            )}
          </div>
          <p id={startId} className="text-muted first-letter:uppercase">
            <time dateTime={activity.started_at}>{start}</time>
          </p>
          {challenges.length > 0 && (
            <p className="text-sm text-muted break-words">
              {t('activities.countsFor', { challenges: challenges.join(' · ') })}
              {activity.distance_meters === null && ` ${t('activities.timeOnly')}`}
            </p>
          )}
        </div>
        {/* Beside the details while there is room, under them otherwise; its
            columns, the same from one activity to the next, wrap when the
            text is enlarged. */}
        <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2 lg:mt-0 lg:grid lg:w-xl lg:max-w-full lg:grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] lg:gap-x-4">
          {stats.map(({ key, value }) => (
            <div key={key} className="flex min-w-0 flex-col-reverse">
              <dt className="text-sm text-muted">{t(`activities.${key}`)}</dt>
              <dd className="font-bold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        {deleteActivity.isPending && (
          <p className="mt-2 text-sm text-muted lg:mt-0">{t('activities.deleting')}</p>
        )}
        {deleteError && (
          <p role="alert" className="mt-2 text-sm font-semibold text-risk-fg lg:mt-0">
            {deleteError}
          </p>
        )}
      </div>
      {/* Stretched to the row's height on a phone: its action keeps its own
          size, at the top, as the "…" button. */}
      <div className="flex flex-none items-start justify-end lg:w-40">
        {activity.locked ? (
          // A lock alone on a phone, with its words from `lg`; the same
          // words for a screen reader.
          <span className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full bg-segment px-3 text-sm font-bold text-muted">
            <Lock aria-hidden="true" size={16} strokeWidth={2} className="shrink-0" />
            <span className="sr-only lg:not-sr-only">{t('activities.judged')}</span>
          </span>
        ) : (
          <ActivityMenu
            activityId={activity.id}
            describedBy={`${titleId} ${startId}`}
            buttonRef={menuButton}
            deleting={deleteActivity.isPending}
            onDelete={() => setConfirming(true)}
          />
        )}
      </div>

      <ConfirmDialog
        open={confirming}
        title={t('activities.deleteConfirm.title')}
        message={t('activities.deleteConfirm.message')}
        confirmLabel={t('activities.deleteConfirm.confirm')}
        cancelLabel={t('activities.deleteConfirm.cancel')}
        onConfirm={() => void remove()}
        onCancel={() => {
          setConfirming(false);
          menuButton.current?.focus();
        }}
        variant="danger"
      />
    </article>
  );
}
