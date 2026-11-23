import { useTranslation } from 'react-i18next';
import { useMyActivitySummary } from '../../api/hooks/useActivities';
import { useTotalTime } from './useTotalTime';

/**
 * "3 défis · 18 activités · 14 h 30 de sport": the challenges joined, the
 * activities and their total time, all counted by the server. Loading and
 * failing here never hold back the rest of the profile.
 */
export function ProfileStats() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  // The totals do not depend on the zone, which only cuts the current week.
  const summary = useMyActivitySummary(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const totalTime = useTotalTime();

  if (summary.isPending) {
    return (
      <div
        role="status"
        aria-busy="true"
        className="mt-5 h-14 w-full rounded-row bg-track motion-safe:animate-pulse"
      >
        <span className="sr-only">{t('states.loading')}</span>
      </div>
    );
  }
  if (summary.isError) {
    return (
      <div className="mt-5 flex w-full flex-col items-center gap-2">
        <p role="alert" className="text-sm text-muted">
          {t('profile.stats.error')}
        </p>
        <button
          type="button"
          // Not `disabled`: the focus stays on it while it reloads.
          aria-disabled={summary.isFetching}
          aria-busy={summary.isFetching}
          onClick={() => {
            if (!summary.isFetching) void summary.refetch();
          }}
          className="h-11 rounded-full border border-border bg-surface hover-fill px-5 text-sm font-bold aria-disabled:opacity-60"
        >
          {t('errorPage.retry')}
        </button>
      </div>
    );
  }

  const { challenge_count, total, total_duration_seconds } = summary.data;
  const number = new Intl.NumberFormat(locale);
  const time = totalTime(total_duration_seconds);

  const STAT = 'flex min-w-0 flex-col items-center gap-0.5 break-words';
  const VALUE = 'font-display text-xl font-bold tabular-nums';
  return (
    <ul
      aria-label={t('profile.stats.label')}
      className="mt-5 grid w-full grid-cols-3 gap-2 border-t border-border pt-5"
    >
      <li className={STAT}>
        <span className={VALUE}>{number.format(challenge_count)}</span>
        <span className="text-sm text-muted">
          {t('profile.stats.challenges', { count: challenge_count })}
        </span>
      </li>
      <li className={STAT}>
        <span className={VALUE}>{number.format(total)}</span>
        <span className="text-sm text-muted">
          {t('profile.stats.activities', { count: total })}
        </span>
      </li>
      <li className={STAT}>
        <span aria-hidden="true" className={VALUE}>
          {time.shown}
        </span>
        <span aria-hidden="true" className="text-sm text-muted">
          {t('profile.stats.time')}
        </span>
        <span className="sr-only">{t('profile.stats.spokenTime', { duration: time.spoken })}</span>
      </li>
    </ul>
  );
}
