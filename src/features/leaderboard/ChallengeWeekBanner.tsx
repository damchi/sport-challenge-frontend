import { Flag, Timer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLeaderboard, type ChallengeDetail } from '../../api/hooks/useChallenges';
import {
  challengeInstant,
  challengeLastDay,
  challengeTime,
  otherTimeZoneName,
} from '../../domain/format/challengeDates';

/**
 * Where a challenge stands in time, below its header. During its weeks (the
 * server's current_week), a dark banner: the current week and its end, then
 * when the leaderboards were computed. Once finished (the server's status),
 * its results are final: it says so, with its last day. Upcoming: nothing.
 * Every date is in the challenge's time zone, named when the user's differs.
 */
export function ChallengeWeekBanner({ challenge }: { challenge: ChallengeDetail }) {
  const { t, i18n } = useTranslation();
  const leaderboard = useLeaderboard(challenge.id);
  const locale = i18n.resolvedLanguage ?? 'fr';
  const { timezone } = challenge;
  const zone = otherTimeZoneName(
    timezone,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale,
  );

  if (challenge.status === 'finished') {
    return (
      <p className="mt-4 flex items-start gap-2 font-semibold">
        <Flag aria-hidden="true" size={18} strokeWidth={2} className="mt-0.5 flex-none" />
        {t('leaderboard.final', {
          date: challengeLastDay(challenge.ends_at, timezone, locale),
          zone,
          context: zone && 'zone',
        })}
      </p>
    );
  }
  if (challenge.current_week === null || challenge.week_ends_at === null) return null;

  const computedAt = leaderboard.data?.computed_at;
  return (
    <div className="mt-5 flex items-start gap-3 rounded-row border border-raised-border bg-surface-raised px-4 py-3 text-on-raised">
      <Timer
        aria-hidden="true"
        size={22}
        strokeWidth={2}
        className="mt-0.5 flex-none text-accent"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-x-4 gap-y-1 lg:flex-row lg:items-center lg:justify-between">
        <p className="font-bold">
          {t('challengeDetail.weekBanner', {
            week: challenge.current_week,
            date: challengeInstant(challenge.week_ends_at, timezone, locale),
            zone,
            context: zone && 'zone',
          })}
        </p>
        {computedAt && (
          <p className="text-sm text-on-raised-muted">
            {t('leaderboard.updated', {
              date: challengeTime(computedAt, timezone, locale),
              zone,
              context: zone && 'zone',
            })}
          </p>
        )}
      </div>
    </div>
  );
}
