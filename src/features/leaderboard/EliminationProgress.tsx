import { Check, Timer, TriangleAlert, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ChallengeDetail, LeaderboardEntry } from '../../api/hooks/useChallenges';
import { StatusPill } from '../../components/StatusPill';
import { challengeInstant, otherTimeZoneName } from '../../domain/format/challengeDates';
import { formatKm } from '../../domain/format/distance';

type Progress = NonNullable<LeaderboardEntry['elimination']>;
type LiveStatus = Exclude<NonNullable<Progress['status']>, 'eliminated'>;

// Never the colour alone: each status has its icon and its label (design.md).
const STATUSES: Record<
  LiveStatus,
  { Icon: LucideIcon; tone: 'ok' | 'risk' | 'neutral'; bar: string }
> = {
  reached: { Icon: Check, tone: 'ok', bar: 'bg-ok-bar' },
  at_risk: { Icon: TriangleAlert, tone: 'risk', bar: 'bg-risk-bar' },
  in_progress: { Icon: Timer, tone: 'neutral', bar: 'bg-rank-bar' },
};

/**
 * The week of a survivor in the run elimination: status, distance run against
 * the minimum of the week, and a bar. Every value is the server's.
 */
export function EliminationProgress({ progress }: { progress: Progress }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const status = progress.status;
  if (!status || status === 'eliminated' || progress.minimum_meters === null) return null;
  const { Icon, tone, bar } = STATUSES[status];
  const minimum = progress.minimum_meters;
  const share = minimum === 0 ? 1 : Math.min(progress.run_meters / minimum, 1);
  return (
    <span className="mt-1 flex flex-col gap-1">
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <StatusPill label={t(`leaderboard.elimination.${status}`)} Icon={Icon} tone={tone} />
        <span className="text-sm text-muted tabular-nums">
          {t('leaderboard.elimination.progress', {
            run: formatKm(progress.run_meters / 1000, locale),
            minimum: formatKm(minimum / 1000, locale),
          })}
        </span>
      </span>
      {/* The figures are written next to it. */}
      <span aria-hidden="true" className="block h-1.5 overflow-hidden rounded-full bg-track">
        <span className={`block h-full rounded-full ${bar}`} style={{ width: `${share * 100}%` }} />
      </span>
    </span>
  );
}

/**
 * Context of the run elimination, above its ranking: the end of the week in
 * the challenge's time zone, that week 1 eliminates no one, and how the
 * minimum moves (the server applies it; only X is shown here).
 */
export function EliminationContext({
  challenge,
  weekEndsAt,
}: {
  challenge: ChallengeDetail;
  weekEndsAt: string | null;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zone = otherTimeZoneName(challenge.timezone, userTimeZone, locale);
  const step = challenge.categories.find((category) => category.type === 'run_elimination')?.params
    .step_meters;
  return (
    <div className="mt-4 grid gap-1 text-sm text-muted">
      {weekEndsAt && (
        <p className="flex items-center gap-2 font-semibold text-ink">
          <Timer aria-hidden="true" size={16} strokeWidth={2} className="flex-none" />
          {t('challengeDetail.weekEnds', {
            date: challengeInstant(weekEndsAt, challenge.timezone, locale),
            zone,
            context: zone && 'zone',
          })}
        </p>
      )}
      {challenge.current_week === 1 && <p>{t('leaderboard.elimination.firstWeek')}</p>}
      {step !== undefined && (
        <p>{t('leaderboard.elimination.rule', { step: formatKm(step / 1000, locale) })}</p>
      )}
    </div>
  );
}
