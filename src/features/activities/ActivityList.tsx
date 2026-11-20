import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMyActivities } from '../../api/hooks/useActivities';
import { LoadMore } from '../../components/LoadMore';
import { EmptyState } from '../../components/states/EmptyState';
import { ErrorState } from '../../components/states/ErrorState';
import { LoadingState } from '../../components/states/LoadingState';
import { otherTimeZoneName } from '../../domain/format/challengeDates';
import { ActivityItem } from './ActivityItem';
import { useActivityTimeZone } from './useActivityTimeZone';

/**
 * The user's activities, most recent first, page by page. Their starts are
 * shown in the time zone they are entered in (named when it is not the
 * device's). Tests give the device's time zone.
 */
export function ActivityList({ deviceTimeZone }: { deviceTimeZone?: string }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const activities = useMyActivities();
  const zone = useActivityTimeZone(deviceTimeZone);
  // Deletions so far: each one is said where the focus was, its item gone.
  const [deletions, setDeletions] = useState(0);

  if (activities.isPending || zone.isPending) return <LoadingState />;
  // Nothing loaded: the whole list failed (a failed "load more" keeps it).
  if (!activities.data || zone.timeZone === undefined) {
    return (
      <ErrorState
        error={activities.error ?? zone.error}
        onRetry={() => {
          if (activities.isError) void activities.refetch();
          if (zone.isError) zone.refetch();
        }}
      />
    );
  }

  const { timeZone } = zone;
  const items = activities.data.pages.flatMap((page) => page.items);
  const zoneName = otherTimeZoneName(timeZone, zone.deviceTimeZone, locale);

  return (
    <section aria-label={t('activities.listLabel')}>
      {deletions > 0 && <DeletedNotice key={deletions} />}
      {items.length === 0 ? (
        <EmptyState message={t('activities.empty')} />
      ) : (
        <>
          {zoneName && (
            <p className="mb-3 text-sm text-muted">
              {t('activities.timeZone', { zone: zoneName })}
            </p>
          )}
          <ul className="grid gap-3 lg:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] lg:gap-4">
            {items.map((activity) => (
              <li key={activity.id}>
                <ActivityItem
                  activity={activity}
                  timeZone={timeZone}
                  onDeleted={() => setDeletions((count) => count + 1)}
                />
              </li>
            ))}
          </ul>
          <LoadMore
            hasMore={activities.hasNextPage}
            loading={activities.isFetchingNextPage}
            failed={activities.isFetchNextPageError}
            onLoadMore={() => void activities.fetchNextPage()}
          />
        </>
      )}
    </section>
  );
}

/** "Activity deleted", taking the focus once shown. */
function DeletedNotice() {
  const { t } = useTranslation();
  const notice = useRef<HTMLParagraphElement>(null);
  useEffect(() => notice.current?.focus(), []);
  return (
    <p ref={notice} tabIndex={-1} role="status" className="mb-4 font-semibold">
      {t('activities.deleted')}
    </p>
  );
}
