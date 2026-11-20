import { Lock, PenLine } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ApiError, errorMessage } from '../../api/errors';
import { useDeleteActivity, type Activity } from '../../api/hooks/useActivities';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { StatusPill } from '../../components/StatusPill';
import { activityTime } from '../../domain/format/challengeDates';
import { formatKm, formatSpeed } from '../../domain/format/distance';
import { formatActivityDuration } from '../../domain/format/duration';
import { useSportName } from '../challenges/create/useSportName';

/**
 * An activity of the user: sport, start in `timeZone`, duration, distance
 * and the speed the API computes. Changing or deleting it is offered only
 * while the server says it is not `locked`; a locked one is read only and
 * says why. Deleting asks first; once done, `onDeleted` is told.
 */
export function ActivityItem({
  activity,
  timeZone,
  onDeleted,
}: {
  activity: Activity;
  timeZone: string;
  onDeleted: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const sportName = useSportName();
  const deleteActivity = useDeleteActivity();
  const [confirming, setConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();
  const titleId = useId();
  const startId = useId();
  const sport =
    activity.sport_code === 'other'
      ? (activity.sport_label ?? t('activities.otherSport'))
      : sportName(activity.sport_code);

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

  return (
    <article aria-labelledby={titleId} className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 id={titleId} className="font-display text-lg font-bold break-words">
          {sport}
        </h2>
        {activity.source === 'manual' && (
          <StatusPill label={t('activities.manual')} Icon={PenLine} tone="neutral" />
        )}
      </div>
      <p id={startId} className="mt-1 text-sm text-muted">
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
        {activity.speed_mps !== null && (
          <div className="flex gap-1">
            <dt className="text-muted">{t('activities.speed')}</dt>
            <dd className="font-semibold tabular-nums">
              {formatSpeed(activity.speed_mps, locale)}
            </dd>
          </div>
        )}
      </dl>

      {activity.locked ? (
        <p className="mt-3 flex items-start gap-2 text-sm text-muted">
          <Lock aria-hidden="true" size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
          {t('activities.locked')}
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to={`/activities/${activity.id}/edit`}
            aria-describedby={`${titleId} ${startId}`}
            className="inline-flex h-11 items-center rounded-full border border-border bg-surface px-5 font-bold"
          >
            {t('activities.edit')}
          </Link>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={deleteActivity.isPending}
            aria-describedby={`${titleId} ${startId}`}
            className="h-11 rounded-full border border-border bg-surface px-5 font-bold text-risk-fg disabled:opacity-60"
          >
            {deleteActivity.isPending ? t('activities.deleting') : t('activities.delete')}
          </button>
        </div>
      )}
      {deleteError && (
        <p role="alert" className="mt-3 text-sm font-semibold text-risk-fg">
          {deleteError}
        </p>
      )}

      <ConfirmDialog
        open={confirming}
        title={t('activities.deleteConfirm.title')}
        message={t('activities.deleteConfirm.message')}
        confirmLabel={t('activities.deleteConfirm.confirm')}
        cancelLabel={t('activities.deleteConfirm.cancel')}
        onConfirm={() => void remove()}
        onCancel={() => setConfirming(false)}
      />
    </article>
  );
}
