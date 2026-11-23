import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useMyActivities } from '../../api/hooks/useActivities';
import { LoadMore } from '../../components/LoadMore';
import { EmptyState } from '../../components/states/EmptyState';
import { ErrorState } from '../../components/states/ErrorState';
import { LoadingState } from '../../components/states/LoadingState';
import { groupByWeek, weekKind, type ActivityWeek } from '../../domain/activityWeeks';
import { localDate } from '../../domain/challengeWindow';
import { weekDays, weekMonday } from '../../domain/format/activityDates';
import { otherTimeZoneName } from '../../domain/format/challengeDates';
import type { Activity } from '../../api/hooks/useActivities';
import { ActivityItem } from './ActivityItem';
import { useActivityTimeZone } from './useActivityTimeZone';

/**
 * The user's activities, most recent first, page by page, grouped by week
 * (Monday to Sunday) in the time zone they are entered in (named when it is
 * not the device's); a week cut by a page is completed by the next one.
 * Tests give the device's time zone and the clock.
 */
export function ActivityList({
  deviceTimeZone,
  now: givenNow,
}: {
  deviceTimeZone?: string;
  now?: Date;
}) {
  const { t, i18n } = useTranslation();
  const [now, setNow] = useState(() => givenNow ?? new Date());
  // "Today" and "this week" read again when the user comes back to the page.
  useEffect(() => {
    if (givenNow) return;
    const reread = () => {
      if (document.visibilityState === 'visible') setNow(new Date());
    };
    document.addEventListener('visibilitychange', reread);
    return () => document.removeEventListener('visibilitychange', reread);
  }, [givenNow]);
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
          <div className="flex flex-col gap-8">
            {groupByWeek(items, timeZone).map((week) => (
              <WeekGroup key={week.monday} week={week} timeZone={timeZone} now={now}>
                {(activity) => (
                  <ActivityItem
                    activity={activity}
                    timeZone={timeZone}
                    now={now}
                    onDeleted={() => setDeletions((count) => count + 1)}
                  />
                )}
              </WeekGroup>
            ))}
          </div>
          <LoadMore
            hasMore={activities.hasNextPage}
            loading={activities.isFetchingNextPage}
            failed={activities.isFetchNextPageError}
            onLoadMore={() => void activities.fetchNextPage()}
          />
          <p className="mt-6 text-sm text-muted">{t('activities.rule')}</p>
        </>
      )}
    </section>
  );
}

/**
 * A week of activities: "This week", "Last week" or "Week of 9 Nov", its
 * days, then its activities in one card. The year shows when it is not the
 * current one.
 */
function WeekGroup({
  week,
  timeZone,
  now,
  children,
}: {
  week: ActivityWeek<Activity>;
  timeZone: string;
  now: Date;
  children: (activity: Activity) => ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const titleId = useId();
  const withYear = week.monday.slice(0, 4) !== localDate(now, timeZone).slice(0, 4);
  const kind = weekKind(week.monday, now, timeZone);
  const title =
    kind === 'other'
      ? t('activities.weekOf', { day: weekMonday(week.monday, locale, withYear) })
      : t(kind === 'current' ? 'activities.thisWeek' : 'activities.lastWeek');

  return (
    <section aria-labelledby={titleId}>
      <h2 id={titleId} className="mb-3 font-display text-lg font-bold">
        {title}
        <span className="font-sans text-base font-normal text-muted">
          {' · '}
          {weekDays(week.monday, week.sunday, locale, withYear)}
        </span>
      </h2>
      <ul className="divide-y divide-border rounded-card border border-border bg-surface">
        {week.activities.map((activity) => (
          <li key={activity.id}>{children(activity)}</li>
        ))}
      </ul>
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
