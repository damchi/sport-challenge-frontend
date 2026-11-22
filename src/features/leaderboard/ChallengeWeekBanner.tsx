import { Flag, Timer } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useChallenge, useLeaderboard, type ChallengeDetail } from '../../api/hooks/useChallenges';
import {
  challengeInstant,
  challengeLastDay,
  challengePeriod,
  challengeTime,
  otherTimeZoneName,
} from '../../domain/format/challengeDates';
import { countdown } from '../../domain/format/countdown';

/**
 * Where a challenge stands in time, below its header. During its weeks (the
 * server's current_week), a dark banner: the current week and its end, then
 * when the leaderboards were computed. Once finished (the server's status),
 * its results are final: it says so, with its last day. Upcoming: the time
 * left before the start (ChallengeStartBanner).
 * Every date is in the challenge's time zone, named when the user's differs.
 */
export function ChallengeWeekBanner({ challenge }: { challenge: ChallengeDetail }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const { timezone } = challenge;
  const zone = otherTimeZoneName(
    timezone,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale,
  );

  if (challenge.status === 'upcoming') return <ChallengeStartBanner challenge={challenge} />;
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
  return (
    <WeekBanner
      challenge={challenge}
      week={challenge.current_week}
      weekEndsAt={challenge.week_ends_at}
      zone={zone}
    />
  );
}

/**
 * The current week and its end, then when the leaderboards were computed:
 * the leaderboard is read only here, for an ongoing challenge.
 */
function WeekBanner({
  challenge,
  week,
  weekEndsAt,
  zone,
}: {
  challenge: ChallengeDetail;
  week: number;
  weekEndsAt: string;
  zone: string | undefined;
}) {
  const { t, i18n } = useTranslation();
  const leaderboard = useLeaderboard(challenge.id);
  const locale = i18n.resolvedLanguage ?? 'fr';
  const { timezone } = challenge;
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
            week,
            date: challengeInstant(weekEndsAt, timezone, locale),
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

/** How many times an upcoming challenge is read again once its start is reached. */
const MAX_START_RELOADS = 10;

/** The clock, read again every 30 s: the countdown shows minutes. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/**
 * Before an upcoming challenge: the time left before its start, the start
 * in its time zone (named when the user's differs), how many weeks it lasts
 * (the server's week_count) until its last day, its weeks, and that only the
 * activities from the start will count. Once the start is reached, it says
 * so and reads the challenge again at each tick of the clock, a few times,
 * until the server says it is ongoing (this banner is then gone).
 */
function ChallengeStartBanner({ challenge }: { challenge: ChallengeDetail }) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const { timezone } = challenge;
  const zone = otherTimeZoneName(
    timezone,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale,
  );
  const reload = useChallenge(challenge.id).refetch;
  const left = countdown(now, new Date(challenge.starts_at));
  const started = now.getTime() >= new Date(challenge.starts_at).getTime();
  // Past the start, read again at each tick, 10 times at most (5 min): then
  // the usual reload on coming back to the page takes over.
  const reloads = useRef(0);
  useEffect(() => {
    if (!started || reloads.current >= MAX_START_RELOADS) return;
    reloads.current += 1;
    void reload();
  }, [started, now, reload]);
  const { end } = challengePeriod(challenge.starts_at, challenge.ends_at, timezone, locale);
  const weeks = Array.from({ length: challenge.week_count }, (_, index) => index + 1);
  // Read whole by screen readers: "7 jours, 1 heure et 31 minutes".
  const spoken = t('challengeDetail.upcoming.left', {
    days: t('challengeDetail.upcoming.daysLong', { count: left.days }),
    hours: t('challengeDetail.upcoming.hoursLong', { count: left.hours }),
    minutes: t('challengeDetail.upcoming.minutesLong', { count: left.minutes }),
  });
  const parts = [
    { value: left.days, unit: t('challengeDetail.upcoming.days', { count: left.days }) },
    { value: left.hours, unit: t('challengeDetail.upcoming.hours') },
    { value: left.minutes, unit: t('challengeDetail.upcoming.minutes') },
  ];

  return (
    <section
      aria-labelledby="challenge-start"
      className="mt-5 rounded-card border border-raised-border bg-surface-raised p-5 text-on-raised lg:p-6"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2
            id="challenge-start"
            className="text-sm font-bold tracking-wide text-on-raised-soft uppercase"
          >
            {t('challengeDetail.upcoming.startsIn')}
          </h2>
          {started ? (
            <p className="mt-2 font-display text-2xl font-bold">
              {t('challengeDetail.upcoming.starting')}
            </p>
          ) : (
            <p className="mt-2">
              <span className="sr-only">{spoken}</span>
              <span aria-hidden="true" className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                {parts.map(({ value, unit }) => (
                  <span key={unit} className="whitespace-nowrap">
                    <span className="font-display text-5xl font-bold tabular-nums">{value}</span>{' '}
                    <span className="text-on-raised-soft">{unit}</span>
                  </span>
                ))}
              </span>
            </p>
          )}
        </div>
        <div className="lg:text-right">
          <p className="font-semibold">
            {t('challengeDetail.upcoming.startsAt', {
              date: challengeInstant(challenge.starts_at, timezone, locale),
              zone,
              context: zone && 'zone',
            })}
          </p>
          <p className="text-on-raised-muted">
            {t('challengeDetail.upcoming.duration', { count: challenge.week_count, date: end })}
          </p>
        </div>
      </div>
      <ol
        aria-label={t('challengeDetail.upcoming.weeks')}
        // A long challenge wraps its weeks rather than squeezing them.
        className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(2.75rem,1fr))] gap-2"
      >
        {weeks.map((week) => (
          <li key={week} className="text-xs text-on-raised-muted">
            <span aria-hidden="true" className="mb-2 block h-1.5 rounded-full bg-track-raised" />
            {t('challengeDetail.upcoming.week', { week })}
          </li>
        ))}
      </ol>
      <p className="mt-4 text-sm">{t('challengeDetail.upcoming.note')}</p>
    </section>
  );
}
