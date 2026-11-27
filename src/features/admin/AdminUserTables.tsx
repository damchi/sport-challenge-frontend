import { Plus } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  useAdminUserActivities,
  useAdminUserChallenges,
  type AdminActivity,
} from '../../api/hooks/admin/useAdminUsers';
import { useFetchAllPages } from '../../api/hooks/useFetchAllPages';
import { groupByWeek, dayKind } from '../../domain/activityWeeks';
import { userChallengeRole } from '../../domain/adminUsers';
import { activityClock, activityDay } from '../../domain/format/activityDates';
import { formatKm } from '../../domain/format/distance';
import { formatActivityDuration } from '../../domain/format/duration';
import { usePageSize } from '../../lib/pageSize';
import { ActivityMenu } from '../activities/ActivityMenu';
import { WeekGroup } from '../activities/ActivityList';
import { ElevationGain } from '../activities/ElevationGain';
import { SportIcon } from '../activities/SportIcon';
import { useSportName } from '../challenges/create/useSportName';
import { AdminTable } from './AdminTable';
import { CELL } from './adminCells';
import { PagedPart } from './PagedPart';

type At = (instant: string) => string;

// Said where the eye is: the row clicked is gone, or far below the message.
const focusOnShow = (element: HTMLElement | null) => element?.focus();

/**
 * The challenges of the account, deleted ones included, most recently
 * created first: its role there, the status, when it joined; each opens the
 * admin's sheet of the challenge.
 */
export function AdminUserChallenges({ userId, at }: { userId: string; at: At }) {
  const { t } = useTranslation();
  const [size, setSize] = usePageSize('adminUserChallenges');
  const challenges = useAdminUserChallenges(userId, size);
  useFetchAllPages(challenges, size === 'all');
  const items = challenges.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <PagedPart
      title={t('admin.users.challenges.title')}
      empty={t('admin.users.challenges.empty')}
      list={challenges}
      size={size}
      onSize={setSize}
      table={
        <AdminTable
          caption={t('admin.users.challenges.title')}
          columns={[
            t('admin.users.challenges.challenge'),
            t('admin.users.challenges.role'),
            t('admin.users.challenges.status'),
            t('admin.users.challenges.joinedAt'),
          ]}
        >
          {items.map((challenge) => (
            <tr key={challenge.id}>
              <th scope="row" className={`${CELL} font-semibold`}>
                <Link
                  to={`/admin/challenges/${challenge.id}`}
                  className="inline-flex min-h-11 items-center text-accent underline underline-offset-4 hover-link"
                >
                  {challenge.title}
                </Link>
                {challenge.deleted_at !== null && (
                  <span className="block text-xs font-normal text-muted">
                    {t('admin.challenges.deletedOne')}
                  </span>
                )}
              </th>
              <td className={CELL}>
                {t(`admin.users.challenges.roles.${userChallengeRole(challenge)}`)}
                {challenge.abandoned_at && (
                  <span className="block text-muted">
                    {t('admin.users.challenges.abandonedAt', { date: at(challenge.abandoned_at) })}
                  </span>
                )}
              </td>
              <td className={CELL}>{t(`admin.challenges.status.${challenge.status}`)}</td>
              <td className={CELL}>
                {challenge.joined_at ? (
                  at(challenge.joined_at)
                ) : (
                  <span className="text-muted">{t('admin.users.challenges.notJoined')}</span>
                )}
              </td>
            </tr>
          ))}
        </AdminTable>
      }
    />
  );
}

/** What the admin may do to the activities of an account not deleted. */
export interface ActivityChanges {
  /** A change is being previewed: no other is asked meanwhile. */
  pending: boolean;
  /** Why the preview of a deletion was refused. */
  refused: string | undefined;
  /** Said once a deletion is made. */
  deleted: boolean;
  onDelete: (activity: AdminActivity) => void;
}

/**
 * The activities of the account, deleted ones excluded, the most recent
 * session first, in cards grouped by week (Monday to Sunday) in `timeZone`:
 * sport, start, duration, distance and elevation gain. With `changes`, the
 * admin adds one, or changes or deletes any, in any week, from its "…" menu.
 */
export function AdminUserActivities({
  userId,
  timeZone,
  changes,
}: {
  userId: string;
  timeZone: string;
  changes?: ActivityChanges;
}) {
  const { t } = useTranslation();
  // "Today" and "this week" as the sheet opened.
  const [now] = useState(() => new Date());
  const [size, setSize] = usePageSize('adminUserActivities');
  const activities = useAdminUserActivities(userId, size);
  useFetchAllPages(activities, size === 'all');
  const items = activities.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <PagedPart
      title={t('admin.users.activities.title')}
      empty={t('admin.users.activities.empty')}
      list={activities}
      size={size}
      onSize={setSize}
      action={
        changes && (
          <Link
            to={`/admin/users/${encodeURIComponent(userId)}/activities/new`}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 font-bold text-on-accent hover-accent"
          >
            <Plus aria-hidden="true" size={18} />
            {t('admin.users.activities.add')}
          </Link>
        )
      }
      intro={
        changes &&
        (changes.refused ? (
          <p ref={focusOnShow} tabIndex={-1} role="alert" className="font-semibold text-risk-fg">
            {changes.refused}
          </p>
        ) : (
          changes.deleted && (
            <p ref={focusOnShow} tabIndex={-1} role="status" className="font-semibold text-ok-fg">
              {t('admin.users.activities.deleted')}
            </p>
          )
        ))
      }
      table={
        <div className="flex flex-col gap-6">
          {groupByWeek(items, timeZone).map((week) => (
            <WeekGroup
              key={week.monday}
              week={week}
              totals={undefined}
              timeZone={timeZone}
              now={now}
              Heading="h4"
            >
              {(activity) => (
                <AdminActivityCard
                  userId={userId}
                  activity={activity}
                  timeZone={timeZone}
                  now={now}
                  changes={changes}
                />
              )}
            </WeekGroup>
          ))}
          {changes && <p className="text-sm text-muted">{t('admin.users.activities.rule')}</p>}
        </div>
      }
    />
  );
}

/** An activity of the account, one card of its week, with its "…" menu. */
function AdminActivityCard({
  userId,
  activity,
  timeZone,
  now,
  changes,
}: {
  userId: string;
  activity: AdminActivity;
  timeZone: string;
  now: Date;
  changes: ActivityChanges | undefined;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const sportName = useSportName();
  // Never focused back here: a deletion goes on in the preview, which takes
  // the place of the sheet, and its outcome is said (and focused) above.
  const menuButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
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
  return (
    <article aria-labelledby={titleId} className="flex gap-3 p-4">
      <SportIcon code={activity.sport_code} />
      <div className="min-w-0 flex-1">
        <h5 id={titleId} className="font-bold break-words">
          {sport}
          {' · '}
          <time dateTime={activity.started_at}>{start}</time>
        </h5>
        <p className="text-muted tabular-nums">
          {formatActivityDuration(activity.duration_seconds)}
          {' · '}
          {activity.distance_meters === null
            ? t('admin.users.activities.noDistance')
            : formatKm(activity.distance_meters / 1000, locale)}
          {activity.elevation_gain_meters !== null && (
            <>
              {' · '}
              <ElevationGain meters={activity.elevation_gain_meters} />
            </>
          )}
        </p>
      </div>
      {changes && (
        <ActivityMenu
          editTo={`/admin/users/${encodeURIComponent(userId)}/activities/${encodeURIComponent(activity.id)}`}
          describedBy={titleId}
          buttonRef={menuButton}
          deleting={changes.pending}
          onDelete={() => changes.onDelete(activity)}
        />
      )}
    </article>
  );
}
