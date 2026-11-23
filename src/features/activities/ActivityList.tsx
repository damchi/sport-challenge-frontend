import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import {
  useMyActivities,
  useMyActivitySummary,
  type ActivityWeekTotals,
} from '../../api/hooks/useActivities';
import { LoadMore } from '../../components/LoadMore';
import { EmptyState } from '../../components/states/EmptyState';
import { ErrorState } from '../../components/states/ErrorState';
import { LoadingState } from '../../components/states/LoadingState';
import { isSportCode } from '../../domain/activity';
import { groupByWeek, weekKind, type ActivityWeek } from '../../domain/activityWeeks';
import { localDate } from '../../domain/challengeWindow';
import { weekDays, weekMonday } from '../../domain/format/activityDates';
import { otherTimeZoneName } from '../../domain/format/challengeDates';
import { formatKm } from '../../domain/format/distance';
import { formatDuration } from '../../domain/format/duration';
import type { Activity } from '../../api/hooks/useActivities';
import { ActivityItem } from './ActivityItem';
import { SportFilter } from './SportFilter';
import { useActivityTimeZone } from './useActivityTimeZone';
import { useSpokenDuration } from './useSpokenDuration';
import { useWeekTotals } from './useWeekTotals';
import { WeekSummaryCard } from './WeekSummaryCard';

/**
 * The user's activities: the summary of the current week, the sport filter
 * (in the address, ?sport=, so going back keeps it), then the activities of
 * that sport, most recent first, page by page, grouped by week (Monday to
 * Sunday) with the totals of each week. Weeks and days are cut in the time
 * zone the activities are entered in (named when it is not the device's); a
 * week cut by a page is completed by the next one. Every total comes from
 * the server. Tests give the device's time zone and the clock.
 */
export function ActivityList({
  deviceTimeZone,
  now: givenNow,
}: {
  deviceTimeZone?: string;
  now?: Date;
}) {
  const { t } = useTranslation();
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
  const [params, setParams] = useSearchParams();
  const sportParam = params.get('sport');
  const zone = useActivityTimeZone(deviceTimeZone);
  const { timeZone } = zone;
  const summary = useMyActivitySummary(timeZone);
  // A sport the user no longer has an activity of (the last one deleted) is
  // let go: the filter shows every sport again.
  const asked = isSportCode(sportParam) ? sportParam : undefined;
  const sport =
    asked && summary.data?.sports.every(({ sport_code }) => sport_code !== asked)
      ? undefined
      : asked;
  const activities = useMyActivities(sport);
  const { weeks, totals } = useWeekTotals(
    timeZone,
    sport,
    activities.data?.pages.at(-1)?.items.at(-1),
  );
  // Deletions so far: each one is said where the focus was, its item gone.
  const [deletions, setDeletions] = useState(0);

  const select = (value: string | undefined) => {
    const next = new URLSearchParams(params);
    if (value) next.set('sport', value);
    else next.delete('sport');
    setParams(next, { replace: true });
  };

  if (zone.isPending) return <LoadingState />;
  if (timeZone === undefined) {
    return <ErrorState error={zone.error} onRetry={zone.refetch} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <WeekSummaryCard timeZone={timeZone} now={now} />
      {summary.data && summary.data.total > 0 && (
        <SportFilter summary={summary.data} selected={sport} onSelect={select} />
      )}
      <section aria-label={t('activities.listLabel')}>
        {deletions > 0 && <DeletedNotice key={deletions} />}
        <WeekList
          sport={sport}
          timeZone={timeZone}
          deviceTimeZone={zone.deviceTimeZone}
          now={now}
          activities={activities}
          weeks={weeks}
          totals={totals}
          onDeleted={() => setDeletions((count) => count + 1)}
        />
      </section>
    </div>
  );
}

/**
 * The activities grouped by week, with their states: loading, error with a
 * retry, nothing yet (or nothing of the sport chosen).
 */
function WeekList({
  sport,
  timeZone,
  deviceTimeZone,
  now,
  activities,
  weeks,
  totals,
  onDeleted,
}: {
  sport: string | undefined;
  timeZone: string;
  deviceTimeZone: string;
  now: Date;
  activities: ReturnType<typeof useMyActivities>;
  weeks: ReturnType<typeof useWeekTotals>['weeks'];
  totals: ReadonlyMap<string, ActivityWeekTotals>;
  onDeleted: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';

  // The totals of the weeks are extra: the list shows without them meanwhile.
  if (activities.isPending) return <LoadingState />;
  // Nothing loaded: the whole list failed (a failed "load more" keeps it).
  if (!activities.data) {
    return <ErrorState error={activities.error} onRetry={() => void activities.refetch()} />;
  }

  const items = activities.data.pages.flatMap((page) => page.items);
  const zoneName = otherTimeZoneName(timeZone, deviceTimeZone, locale);

  return (
    <>
      {/* Totals missing (a page of weeks failed): the list stays, a retry above. */}
      {weeks.isError && items.length > 0 && (
        <div className="mb-6">
          <ErrorState
            error={weeks.error}
            onRetry={() =>
              void (weeks.isFetchNextPageError ? weeks.fetchNextPage() : weeks.refetch())
            }
          />
        </div>
      )}
      {items.length === 0 ? (
        <EmptyState message={t(sport ? 'activities.filter.empty' : 'activities.empty')} />
      ) : (
        <>
          {zoneName && (
            <p className="mb-3 text-sm text-muted">
              {t('activities.timeZone', { zone: zoneName })}
            </p>
          )}
          <div className="flex flex-col gap-8">
            {groupByWeek(items, timeZone).map((week) => (
              <WeekGroup
                key={week.monday}
                week={week}
                totals={totals.get(week.monday)}
                timeZone={timeZone}
                now={now}
              >
                {(activity) => (
                  <ActivityItem
                    activity={activity}
                    timeZone={timeZone}
                    now={now}
                    onDeleted={onDeleted}
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
    </>
  );
}

/**
 * A week of activities: "This week", "Last week" or "Week of 9 Nov", its
 * days, the server's totals once loaded ("4 sessions · 2:36 · 26 km", the
 * distance left out at 0), then its activities in one card. The year shows
 * when it is not the current one.
 */
function WeekGroup({
  week,
  totals,
  timeZone,
  now,
  children,
}: {
  week: ActivityWeek<Activity>;
  totals: ActivityWeekTotals | undefined;
  timeZone: string;
  now: Date;
  children: (activity: Activity) => ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const spoken = useSpokenDuration();
  const titleId = useId();
  const withYear = week.monday.slice(0, 4) !== localDate(now, timeZone).slice(0, 4);
  const kind = weekKind(week.monday, now, timeZone);
  const title =
    kind === 'other'
      ? t('activities.weekOf', { day: weekMonday(week.monday, locale, withYear) })
      : t(kind === 'current' ? 'activities.thisWeek' : 'activities.lastWeek');

  return (
    <section aria-labelledby={titleId}>
      <div className="mb-3 flex flex-col gap-0.5 lg:flex-row lg:items-baseline lg:justify-between lg:gap-4">
        <h2 id={titleId} className="font-display text-lg font-bold">
          {title}
          <span className="font-sans text-base font-normal text-muted">
            {' · '}
            {weekDays(week.monday, week.sunday, locale, withYear)}
          </span>
        </h2>
        {totals && (
          <p className="text-muted">
            {t('activities.sessions', { count: totals.sessions })}
            {' · '}
            <span aria-hidden="true">{formatDuration(totals.duration_seconds)}</span>
            <span className="sr-only">{spoken(totals.duration_seconds)}</span>
            {totals.distance_meters > 0 && ` · ${formatKm(totals.distance_meters / 1000, locale)}`}
          </p>
        )}
      </div>
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
