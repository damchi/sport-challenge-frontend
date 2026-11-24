import { Check, CircleX, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AdminWorkerRun, AdminWorkerTask } from '../../api/hooks/admin/useAdminStats';
import { dateTime } from '../../domain/format/instant';

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
 * failure with the failure's code (a stable code, never a message). A table
 * that scrolls sideways on a phone.
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
  const CELL = 'border-t border-border px-4 py-3 text-left align-top';
  return (
    <section aria-labelledby="admin-worker">
      <h2 id="admin-worker" className="font-display text-lg font-bold">
        {t('admin.dashboard.worker.title')}
      </h2>
      {/* Focusable, so that the keyboard scrolls it too. */}
      <div
        role="region"
        aria-labelledby="admin-worker"
        tabIndex={0}
        className="mt-3 overflow-x-auto rounded-card border border-border bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <table className="w-full min-w-120 text-sm">
          <caption className="sr-only">{t('admin.dashboard.worker.title')}</caption>
          <thead>
            <tr className="text-muted">
              <th scope="col" className="px-4 py-3 text-left font-semibold">
                {t('admin.dashboard.worker.task')}
              </th>
              <th scope="col" className="px-4 py-3 text-left font-semibold">
                {t('admin.dashboard.worker.lastRun')}
              </th>
              <th scope="col" className="px-4 py-3 text-left font-semibold">
                {t('admin.dashboard.worker.lastFailure')}
              </th>
            </tr>
          </thead>
          <tbody>
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
          </tbody>
        </table>
      </div>
    </section>
  );
}
