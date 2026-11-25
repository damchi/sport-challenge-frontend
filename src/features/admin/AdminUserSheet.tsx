import { ArrowLeft } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import type { ApiClient } from '../../api/client';
import { ApiError } from '../../api/errors';
import { sendAdminActivityChange } from '../../api/hooks/admin/adminActivities';
import type { CorrectionBody } from '../../api/hooks/admin/useAdminCorrection';
import {
  useAdminUser,
  type AdminActivity,
  type AdminUser,
} from '../../api/hooks/admin/useAdminUsers';
import { ErrorState } from '../../components/states/ErrorState';
import { LoadingState } from '../../components/states/LoadingState';
import { isUserId } from '../../domain/challenge';
import { displayName } from '../../domain/displayName';
import { dateTime } from '../../domain/format/instant';
import { AccountStatePill } from './AccountStatePill';
import { useActivityLine } from './activityLine';
import { AdminUserActivities, AdminUserChallenges, type ActivityChanges } from './AdminUserTables';
import { RecomputeFlow } from './RecomputeFlow';

const CARD = 'rounded-card border border-border bg-surface p-4 lg:p-5';
const H2 = 'font-display text-xl font-bold';

function BackToList() {
  const { t } = useTranslation();
  return (
    <Link
      to="/admin/users"
      className="-ml-2 inline-flex h-11 items-center gap-2 rounded-tab px-2 font-semibold hover-fill"
    >
      <ArrowLeft aria-hidden="true" size={18} />
      {t('admin.users.back')}
    </Link>
  );
}

/**
 * The admin's sheet of an account, deleted or not: its profile with its
 * e-mail, its challenges (each opening the admin's sheet of the challenge)
 * and its activities, page by page, which the admin adds, changes or
 * deletes in any week. Its instants are on the device's zone: an account
 * belongs to no challenge.
 */
export function AdminUserSheet() {
  const { t } = useTranslation();
  const { userId } = useParams();
  const valid = isUserId(userId);
  // An address that cannot be an account asks nothing of the server.
  const user = useAdminUser(valid ? userId : '', valid);

  let content: ReactNode;
  if (!valid || (user.error instanceof ApiError && user.error.code === 'user_not_found')) {
    content = <p className={`${CARD} text-muted`}>{t('admin.users.notFound')}</p>;
  } else if (user.isPending) {
    content = <LoadingState />;
  } else if (user.isError) {
    content = <ErrorState error={user.error} onRetry={() => void user.refetch()} />;
  } else {
    content = <Sheet user={user.data} />;
  }
  return (
    <div className="mt-6 flex flex-col gap-6">
      <BackToList />
      {content}
    </div>
  );
}

/**
 * The sheet, and the deletion of one of its activities through
 * `RecomputeFlow` (preview, reason, "danger" confirmation), whose preview
 * takes the place of the sheet. Once made, the sheet comes back, read again,
 * and says so.
 */
function Sheet({ user }: { user: AdminUser }) {
  const { t } = useTranslation();
  const line = useActivityLine();
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [target, setTarget] = useState<AdminActivity | null>(null);
  const [deleted, setDeleted] = useState(false);
  // Each deletion made starts a new flow, back on the sheet.
  const [round, setRound] = useState(0);
  // Read by `send` when the preview is asked, before the state is.
  const asked = useRef<AdminActivity | null>(null);
  const name =
    displayName(user) ?? t(user.deleted_at === null ? 'admin.users.noName' : 'admin.users.unnamed');

  const send = (client: ApiClient, body: CorrectionBody) => {
    const activity = asked.current;
    if (!activity) return Promise.resolve(undefined);
    return sendAdminActivityChange(client, { kind: 'delete', activityId: activity.id }, body);
  };

  return (
    <RecomputeFlow
      key={round}
      change={{
        title: t('admin.activityForm.delete.title', { name }),
        details: target ? line(target, zone) : undefined,
      }}
      reasonTitle={t('admin.activityForm.delete.reasonTitle')}
      confirmLabel={t('admin.activityForm.delete.confirm')}
      variant="danger"
      errorScope="admin.activityForm.errors"
      send={send}
      onDone={() => {
        asked.current = null;
        setTarget(null);
        setDeleted(true);
        setRound((value) => value + 1);
      }}
    >
      {({ showPreview, pending, error }) => (
        <SheetContent
          user={user}
          name={name}
          zone={zone}
          changes={
            user.deleted_at === null
              ? {
                  pending,
                  refused: target ? error : undefined,
                  deleted,
                  onDelete: (activity) => {
                    asked.current = activity;
                    setTarget(activity);
                    setDeleted(false);
                    showPreview();
                  },
                }
              : undefined
          }
        />
      )}
    </RecomputeFlow>
  );
}

function SheetContent({
  user,
  name,
  zone,
  changes,
}: {
  user: AdminUser;
  name: string;
  zone: string;
  changes: ActivityChanges | undefined;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const at = (instant: string) => dateTime(instant, zone, locale);
  const missing = t('admin.users.sheet.missing');
  const facts: [string, ReactNode][] = [
    [t('admin.users.sheet.state'), <AccountStatePill key="state" state={user.state} />],
    [t('admin.users.sheet.pseudo'), user.pseudo ?? missing],
    [t('admin.users.sheet.firstName'), user.first_name ?? missing],
    [t('admin.users.sheet.lastName'), user.last_name ?? missing],
    [t('admin.users.sheet.email'), user.email ?? missing],
    [t('admin.users.sheet.createdAt'), at(user.created_at)],
    ...(user.deleted_at
      ? [[t('admin.users.sheet.deletedAt'), at(user.deleted_at)] as [string, ReactNode]]
      : []),
    [
      t('admin.users.sheet.lastActivity'),
      user.last_activity_at ? at(user.last_activity_at) : t('admin.users.never'),
    ],
    [t('admin.users.sheet.challenges'), new Intl.NumberFormat(locale).format(user.challenge_count)],
  ];
  return (
    <article aria-labelledby="admin-user-title" className="flex flex-col gap-8">
      <h2 id="admin-user-title" className={`${H2} break-words`}>
        {name}
      </h2>
      <dl className={CARD}>
        {facts.map(([term, value]) => (
          <div
            key={term}
            className="flex flex-wrap justify-between gap-x-4 border-t border-border py-2.5 first:border-t-0 first:pt-0 last:pb-0"
          >
            <dt className="text-muted">{term}</dt>
            <dd className="ml-auto min-w-0 break-all text-right font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <AdminUserChallenges userId={user.id} at={at} />
      <AdminUserActivities userId={user.id} at={at} locale={locale} changes={changes} />
    </article>
  );
}
