import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminStats } from '../../api/hooks/admin/useAdminStats';
import { ErrorState } from '../../components/states/ErrorState';
import { LoadingState } from '../../components/states/LoadingState';
import { dateTime } from '../../domain/format/instant';
import { AdminWorker } from './AdminWorker';

const HEADING = 'font-display text-lg font-bold';

/** A group of figures, each a tile: its value, big, above its label. */
function Figures({ title, figures }: { title: string; figures: [label: string, value: number][] }) {
  const { i18n } = useTranslation();
  const number = new Intl.NumberFormat(i18n.resolvedLanguage ?? 'fr');
  return (
    <section>
      <h2 className={HEADING}>{title}</h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {figures.map(([label, value]) => (
          // Read label first; shown value first.
          <div
            key={label}
            className="flex flex-col-reverse gap-1 rounded-card border border-border bg-surface p-4"
          >
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="font-display text-2xl font-bold tabular-nums">{number.format(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * The admin dashboard: accounts, challenges by status, recent activity and
 * Auth0 deletions waiting, as counted by the server when asked, then the
 * worker's tasks and the API version.
 */
export function AdminDashboard() {
  const { t, i18n } = useTranslation();
  const stats = useAdminStats();
  let content: ReactNode;
  if (stats.isPending) {
    content = <LoadingState />;
  } else if (stats.isError) {
    content = <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />;
  } else {
    const { accounts, challenges, build } = stats.data;
    const locale = i18n.resolvedLanguage ?? 'fr';
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    content = (
      <div className="flex flex-col gap-8">
        <p className="text-sm text-muted">
          {t('admin.dashboard.computedAt', {
            date: dateTime(stats.data.computed_at, timeZone, locale),
          })}
        </p>
        <Figures
          title={t('admin.dashboard.accounts.title')}
          figures={[
            [t('admin.dashboard.accounts.total'), accounts.total],
            [t('admin.dashboard.accounts.new'), accounts.new_last_7_days],
            [t('admin.dashboard.accounts.active'), accounts.active_last_7_days],
          ]}
        />
        <Figures
          title={t('admin.dashboard.challenges.title')}
          figures={[
            [t('admin.dashboard.challenges.upcoming'), challenges.upcoming],
            [t('admin.dashboard.challenges.ongoing'), challenges.ongoing],
            [t('admin.dashboard.challenges.finished'), challenges.finished],
            [t('admin.dashboard.challenges.deleted'), challenges.deleted],
          ]}
        />
        <Figures
          title={t('admin.dashboard.activity.title')}
          figures={[
            [t('admin.dashboard.activity.activities'), stats.data.activities_last_7_days],
            [t('admin.dashboard.activity.pendingDeletions'), stats.data.pending_auth0_deletions],
          ]}
        />
        <AdminWorker tasks={stats.data.worker_tasks} timeZone={timeZone} locale={locale} />
        <p className="text-sm text-muted">
          {t('admin.dashboard.version', {
            version: build.version,
            commit: build.commit.slice(0, 7),
          })}
        </p>
      </div>
    );
  }
  return <div className="mt-6">{content}</div>;
}
