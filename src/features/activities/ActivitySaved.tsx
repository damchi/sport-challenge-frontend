import { ChevronRight } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { ActivityContribution } from '../../api/hooks/useActivities';

/**
 * Outcome of a recorded or changed activity (`title` says which): the
 * challenges it counts in, as the server says, each leading to its
 * leaderboard. Counting in none is a success too: it will count in a
 * challenge joined later whose dates contain it.
 */
export function ActivitySaved({
  title,
  contributions,
}: {
  title: string;
  contributions: readonly ActivityContribution[];
}) {
  const { t } = useTranslation();
  const count = contributions.length;
  const status = useRef<HTMLDivElement>(null);
  // Once, when shown: the reloads that follow must not take the focus back.
  useEffect(() => status.current?.focus(), []);
  return (
    <div className="mt-6 flex max-w-md flex-col items-start gap-4">
      <div ref={status} tabIndex={-1} role="status">
        <p className="font-bold">{title}</p>
        <p className="mt-1">
          {count > 0 ? t('activityForm.saved.counts', { count }) : t('activityForm.saved.none')}
        </p>
      </div>
      {count > 0 && (
        <ul className="flex w-full flex-col gap-2">
          {contributions.map(({ challenge_id, challenge_title }) => (
            <li key={challenge_id}>
              <Link
                to={`/challenges/${challenge_id}`}
                className="flex min-h-11 items-center justify-between gap-3 rounded-card border border-border bg-surface px-4 py-3 hover-border"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="font-semibold break-words">{challenge_title}</span>
                  <span className="text-sm text-muted">{t('activityForm.saved.leaderboard')}</span>
                </span>
                <ChevronRight aria-hidden="true" size={20} strokeWidth={2} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link
        to="/activities"
        className="inline-flex h-11 items-center font-semibold text-accent underline"
      >
        {t('activityForm.back')}
      </Link>
    </div>
  );
}
