import { Check, CircleX, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AdminWorkerRun, AdminWorkerTask } from '../../api/hooks/admin/useAdminStats';
import { dateTime } from '../../domain/format/instant';
import { AdminTable } from './AdminTable';
import { CELL } from './adminCells';

const STATUS = 'mt-1 flex items-center gap-1.5 font-semibold';

/** An instant of a run, on its own line. */
function RunTime({
  instant,
  timeZone,
  locale,
}: {
  instant: string;
  timeZone: string;
  locale: string;
}) {
  return (
    <time dateTime={instant} className="block">
      {dateTime(instant, timeZone, locale)}
    </time>
  );
}

/** How the last run went: never red without its icon and its word. */
function RunStatus({ run }: { run: AdminWorkerRun }) {
  const { t } = useTranslation();
  if (run.outcome === 'failed') {
    return (
      <span className={`${STATUS} text-danger`}>
        <CircleX aria-hidden="true" size={16} />
        {t('admin.dashboard.worker.failed')}
      </span>
    );
  }
  if (run.outcome === 'succeeded') {
    return (
      <span className={`${STATUS} text-ok-fg`}>
        <Check aria-hidden="true" size={16} />
        {t('admin.dashboard.worker.succeeded')}
      </span>
    );
  }
  // No end: still going, or stopped by the job's time limit.
  return (
    <span className={`${STATUS} text-muted`}>
      <Clock aria-hidden="true" size={16} />
      {t('admin.dashboard.worker.unfinished')}
    </span>
  );
}

/**
 * The worker's tasks, each with its last run and how it went, and its last
 * failure with the failure's code (a stable code, never a message).
 */
export function AdminWorker({
  tasks,
  timeZone,
  locale,
}: {
  tasks: AdminWorkerTask[];
  timeZone: string;
  locale: string;
}) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="admin-worker">
      <h2 id="admin-worker" className="font-display text-lg font-bold">
        {t('admin.dashboard.worker.title')}
      </h2>
      <div className="mt-3">
        <AdminTable
          caption={t('admin.dashboard.worker.title')}
          columns={[
            t('admin.dashboard.worker.task'),
            t('admin.dashboard.worker.lastRun'),
            t('admin.dashboard.worker.lastFailure'),
          ]}
        >
          {tasks.map(({ task, last_run, last_failure }) => (
            <tr key={task}>
              <th scope="row" className={`${CELL} font-semibold`}>
                {/* A task the contract adds before its label: its identifier. */}
                {t(`admin.dashboard.worker.tasks.${task}`, { defaultValue: task })}
              </th>
              <td className={CELL}>
                {last_run ? (
                  <>
                    <RunTime instant={last_run.started_at} timeZone={timeZone} locale={locale} />
                    <RunStatus run={last_run} />
                  </>
                ) : (
                  <span className="text-muted">{t('admin.dashboard.worker.never')}</span>
                )}
              </td>
              <td className={CELL}>
                {last_failure ? (
                  <>
                    <RunTime
                      instant={last_failure.started_at}
                      timeZone={timeZone}
                      locale={locale}
                    />
                    {last_failure.error_code && (
                      <code className="mt-1 block text-muted">{last_failure.error_code}</code>
                    )}
                  </>
                ) : (
                  <span className="text-muted">{t('admin.dashboard.worker.noFailure')}</span>
                )}
              </td>
            </tr>
          ))}
        </AdminTable>
      </div>
    </section>
  );
}
