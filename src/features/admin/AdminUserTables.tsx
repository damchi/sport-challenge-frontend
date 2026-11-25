import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  useAdminUserActivities,
  useAdminUserChallenges,
} from '../../api/hooks/admin/useAdminUsers';
import { useFetchAllPages } from '../../api/hooks/useFetchAllPages';
import { userChallengeRole } from '../../domain/adminUsers';
import { formatKm, formatMeters } from '../../domain/format/distance';
import { formatActivityDuration } from '../../domain/format/duration';
import { usePageSize } from '../../lib/pageSize';
import { useSportName } from '../challenges/create/useSportName';
import { AdminTable } from './AdminTable';
import { CELL } from './adminCells';
import { PagedPart } from './PagedPart';

type At = (instant: string) => string;

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

/**
 * The activities of the account, deleted ones excluded, the most recent
 * session first: sport, start, duration, distance and elevation gain.
 */
export function AdminUserActivities({
  userId,
  at,
  locale,
}: {
  userId: string;
  at: At;
  locale: string;
}) {
  const { t } = useTranslation();
  const sportName = useSportName();
  const [size, setSize] = usePageSize('adminUserActivities');
  const activities = useAdminUserActivities(userId, size);
  useFetchAllPages(activities, size === 'all');
  const items = activities.data?.pages.flatMap((page) => page.items) ?? [];
  const none = <span className="text-muted">{t('admin.users.activities.none')}</span>;
  return (
    <PagedPart
      title={t('admin.users.activities.title')}
      empty={t('admin.users.activities.empty')}
      list={activities}
      size={size}
      onSize={setSize}
      table={
        <AdminTable
          caption={t('admin.users.activities.title')}
          columns={[
            t('admin.users.activities.sport'),
            t('admin.users.activities.startedAt'),
            t('admin.users.activities.duration'),
            t('admin.users.activities.distance'),
            t('admin.users.activities.elevation'),
          ]}
        >
          {items.map((activity) => (
            <tr key={activity.id}>
              <th scope="row" className={`${CELL} font-semibold`}>
                {activity.sport_code === 'other'
                  ? (activity.sport_label ?? t('activities.otherSport'))
                  : sportName(activity.sport_code)}
              </th>
              <td className={CELL}>{at(activity.started_at)}</td>
              <td className={`${CELL} tabular-nums`}>
                {formatActivityDuration(activity.duration_seconds)}
              </td>
              <td className={`${CELL} whitespace-nowrap tabular-nums`}>
                {activity.distance_meters === null
                  ? none
                  : formatKm(activity.distance_meters / 1000, locale)}
              </td>
              <td className={`${CELL} whitespace-nowrap tabular-nums`}>
                {activity.elevation_gain_meters === null
                  ? none
                  : formatMeters(activity.elevation_gain_meters, locale)}
              </td>
            </tr>
          ))}
        </AdminTable>
      }
    />
  );
}
