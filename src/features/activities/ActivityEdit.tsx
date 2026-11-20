import { Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { useMyActivities, useUpdateActivity, type Activity } from '../../api/hooks/useActivities';
import { ErrorState } from '../../components/states/ErrorState';
import { LoadingState } from '../../components/states/LoadingState';
import { isActivityId } from '../../domain/activity';
import { activityFormValues, type ActivityCreateValues } from '../../domain/schemas/activity';
import { ActivityFormFields } from './ActivityForm';
import { ActivitySaved } from './ActivitySaved';
import { useActivityFormData } from './useActivityFormData';

/**
 * Change of an activity of the address. An id that cannot be one is not
 * looked for. Tests give `now` and the device's time zone.
 */
export function ActivityEdit({
  now,
  deviceTimeZone,
}: {
  now?: () => Date;
  deviceTimeZone?: string;
}) {
  const { activityId } = useParams();
  if (!isActivityId(activityId)) return <ActivityNotFound />;
  return <ActivityEditContent activityId={activityId} now={now} deviceTimeZone={deviceTimeZone} />;
}

/**
 * The API gives an activity only in the user's list: it is looked for there,
 * page after page (one request per page for an old one, until the contract
 * offers a route for a single activity). It opens in the entry form while the server says it is
 * not locked; a locked one is read only and says why. Once changed, the
 * challenges where it now counts are shown.
 */
function ActivityEditContent({
  activityId,
  now,
  deviceTimeZone,
}: {
  activityId: string;
  now?: () => Date;
  deviceTimeZone?: string;
}) {
  const { t, i18n } = useTranslation();
  const activities = useMyActivities();
  const updateActivity = useUpdateActivity();
  const [saved, setSaved] = useState<Activity>();
  const loaded = useActivityFormData(deviceTimeZone, saved !== undefined);
  const activity = activities.data?.pages
    .flatMap((page) => page.items)
    .find((candidate) => candidate.id === activityId);
  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = activities;
  const searching = !activity && hasNextPage && !isError;
  useEffect(() => {
    if (!saved && searching && !isFetchingNextPage) void fetchNextPage();
  }, [saved, searching, isFetchingNextPage, fetchNextPage]);

  if (saved) {
    return <ActivitySaved title={t('activityEdit.saved')} contributions={saved.contributions} />;
  }
  if (activities.isPending || searching) return <LoadingState />;
  if (!activity) {
    if (!activities.data || isError) {
      return <ErrorState error={activities.error} onRetry={() => void activities.refetch()} />;
    }
    return <ActivityNotFound />;
  }
  if (activity.locked) {
    return (
      <p className="mt-6 flex max-w-md items-start gap-2 text-muted">
        <Lock aria-hidden="true" size={18} strokeWidth={2} className="mt-0.5 shrink-0" />
        {t('activities.locked')}
      </p>
    );
  }
  if (loaded.state !== 'ready') return loaded.view;

  const replace = async (values: ActivityCreateValues) => {
    setSaved(await updateActivity.mutateAsync({ activityId, activity: values }));
  };

  return (
    <ActivityFormFields
      sports={loaded.sports}
      timeZone={loaded.timeZone}
      now={now ?? (() => new Date())}
      initialValues={activityFormValues(activity, loaded.timeZone, i18n.resolvedLanguage ?? 'fr')}
      submitKey="activityEdit.submit"
      busy={updateActivity.isPending}
      save={replace}
      weekLockedKey="activityEdit.weekLocked"
    />
  );
}

/** No activity of the user with this id: never existed, or deleted. */
function ActivityNotFound() {
  const { t } = useTranslation();
  return <p className="mt-6 text-muted">{t('errors.activity_not_found')}</p>;
}
