import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { AdminChallengeDetail } from '../../api/hooks/admin/useAdminChallenges';
import { EmptyState } from '../../components/states/EmptyState';
import { displayName } from '../../domain/displayName';
import { challengePeriod } from '../../domain/format/challengeDates';
import { formatKm } from '../../domain/format/distance';
import { AdminTable } from './AdminTable';
import { CELL } from './adminCells';
import { SheetPart } from './SheetPart';

type At = (instant: string) => string;

/** A name, or the words for an account that has none (deleted). */
function useName() {
  const { t } = useTranslation();
  return (user: Parameters<typeof displayName>[0]) =>
    displayName(user) ?? t('admin.challenges.unnamed');
}

/**
 * The weeks, in order: their days, when they lock (and whether they have)
 * and when the worker judged them, as the server says.
 */
export function AdminChallengeWeeks({
  weeks,
  at,
  zone,
  locale,
}: {
  weeks: AdminChallengeDetail['weeks'];
  at: At;
  zone: string;
  locale: string;
}) {
  const { t } = useTranslation();
  return (
    <SheetPart title={t('admin.challenges.weeks.title')}>
      <AdminTable
        caption={t('admin.challenges.weeks.title')}
        columns={[
          t('admin.challenges.weeks.week'),
          t('admin.challenges.weeks.days'),
          t('admin.challenges.weeks.lock'),
          t('admin.challenges.weeks.judged'),
        ]}
      >
        {weeks.map((week) => (
          <tr key={week.number}>
            <th scope="row" className={`${CELL} font-semibold whitespace-nowrap`}>
              {t('admin.challenges.weeks.number', { number: week.number })}
            </th>
            <td className={`${CELL} whitespace-nowrap`}>
              {t(
                'admin.challenges.period',
                challengePeriod(week.starts_at, week.ends_at, zone, locale),
              )}
            </td>
            <td className={CELL}>
              <span className="block">{at(week.locks_at)}</span>
              <span className="block text-muted">
                {t(week.locked ? 'admin.challenges.weeks.locked' : 'admin.challenges.weeks.open')}
              </span>
            </td>
            <td className={CELL}>
              {week.closed_at ? (
                at(week.closed_at)
              ) : (
                <span className="text-muted">{t('admin.challenges.weeks.notJudged')}</span>
              )}
            </td>
          </tr>
        ))}
      </AdminTable>
    </SheetPart>
  );
}

/** The eliminated, earliest week first: the distance they did, against the minimum. */
export function AdminChallengeEliminations({
  eliminations,
  locale,
}: {
  eliminations: AdminChallengeDetail['eliminations'];
  locale: string;
}) {
  const { t } = useTranslation();
  const name = useName();
  const km = (meters: number) => formatKm(meters / 1000, locale);
  return (
    <SheetPart title={t('admin.challenges.eliminations.title')}>
      {eliminations.length === 0 ? (
        <EmptyState message={t('admin.challenges.eliminations.empty')} />
      ) : (
        <AdminTable
          caption={t('admin.challenges.eliminations.title')}
          columns={[
            t('admin.challenges.eliminations.participant'),
            t('admin.challenges.eliminations.week'),
            t('admin.challenges.eliminations.distance'),
          ]}
        >
          {eliminations.map((elimination) => (
            <tr key={elimination.user.id}>
              <th scope="row" className={`${CELL} font-semibold`}>
                {name(elimination.user)}
              </th>
              <td className={`${CELL} whitespace-nowrap`}>
                {t('admin.challenges.weeks.number', { number: elimination.week_number })}
              </td>
              <td className={`${CELL} whitespace-nowrap tabular-nums`}>
                {t('admin.challenges.eliminations.done', {
                  done: km(elimination.distance_meters),
                  required: km(elimination.required_meters),
                })}
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
    </SheetPart>
  );
}

/** Every invitation link, most recent first, with its status (never its token). */
export function AdminChallengeInvitations({
  invitations,
  at,
}: {
  invitations: AdminChallengeDetail['invitations'];
  at: At;
}) {
  const { t } = useTranslation();
  const name = useName();
  return (
    <SheetPart title={t('admin.challenges.invitations.title')}>
      {invitations.length === 0 ? (
        <EmptyState message={t('admin.challenges.invitations.empty')} />
      ) : (
        <AdminTable
          caption={t('admin.challenges.invitations.title')}
          columns={[
            t('admin.challenges.invitations.by'),
            t('admin.challenges.invitations.createdAt'),
            t('admin.challenges.invitations.expiresAt'),
            t('admin.challenges.invitations.status'),
          ]}
        >
          {invitations.map((invitation) => (
            <tr key={invitation.id}>
              <th scope="row" className={`${CELL} font-semibold`}>
                {name(invitation.invited_by)}
              </th>
              <td className={CELL}>{at(invitation.created_at)}</td>
              <td className={CELL}>{at(invitation.expires_at)}</td>
              <td className={CELL}>
                {t(`admin.challenges.invitations.statuses.${invitation.status}`)}
                {invitation.revoked_at && (
                  <span className="block text-muted">
                    {t('admin.challenges.invitations.revokedAt', {
                      date: at(invitation.revoked_at),
                    })}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
    </SheetPart>
  );
}

/**
 * The last admin changes of the challenge, most recent first, with their
 * reason; the journal keeps them all.
 */
export function AdminChallengeActions({
  challengeId,
  actions,
  at,
}: {
  challengeId: string;
  actions: AdminChallengeDetail['recent_actions'];
  at: At;
}) {
  const { t } = useTranslation();
  const name = useName();
  return (
    <SheetPart title={t('admin.challenges.actions.title')}>
      {actions.length === 0 ? (
        <EmptyState message={t('admin.challenges.actions.empty')} />
      ) : (
        <ul className="flex flex-col gap-3">
          {actions.map((action) => (
            <li key={action.id} className="rounded-card border border-border bg-surface p-4">
              <p className="font-bold">
                {/* A change the contract adds before its label: its code. */}
                {t(`admin.actions.${action.action}`, { defaultValue: action.action })}
              </p>
              <p className="mt-1 text-sm text-muted">
                {t('admin.challenges.actions.by', {
                  date: at(action.created_at),
                  name: name(action.admin),
                })}
              </p>
              <p className="mt-2 break-words whitespace-pre-line">
                {t('admin.challenges.actions.reason', { reason: action.reason })}
              </p>
            </li>
          ))}
        </ul>
      )}
      {actions.length > 0 && (
        <Link
          to={`/admin/journal?challenge_id=${challengeId}`}
          className="mt-3 inline-flex min-h-11 items-center text-accent underline underline-offset-4 hover-link"
        >
          {t('admin.challenges.actions.journal')}
        </Link>
      )}
    </SheetPart>
  );
}
