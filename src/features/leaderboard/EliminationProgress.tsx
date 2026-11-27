import { Check, Timer, TriangleAlert, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ChallengeDetail } from '../../api/hooks/useChallenges';
import { StatusPill } from '../../components/StatusPill';
import { formatKm } from '../../domain/format/distance';
import { eliminationLine, STATUS_BARS, type LiveStatus, type Progress } from './eliminationWeek';
import { useEliminationAmount } from './useEntryValue';

// Never the colour alone: each status has its icon and its label (design.md).
const STATUSES: Record<LiveStatus, { Icon: LucideIcon; tone: 'ok' | 'risk' | 'neutral' }> = {
  reached: { Icon: Check, tone: 'ok' },
  at_risk: { Icon: TriangleAlert, tone: 'risk' },
  in_progress: { Icon: Timer, tone: 'neutral' },
};

/** The status of a survivor's week in the elimination: its icon and its label. */
export function EliminationStatusPill({ status }: { status: LiveStatus }) {
  const { t } = useTranslation();
  const { Icon, tone } = STATUSES[status];
  return <StatusPill label={t(`leaderboard.elimination.${status}`)} Icon={Icon} tone={tone} />;
}

/**
 * The week of a survivor in the elimination: status, distance done in the
 * reference sport (or repetitions of the exercise) against the minimum of
 * the week, and a bar. Every value is the server's.
 */
export function EliminationProgress({ progress }: { progress: Progress }) {
  const { t } = useTranslation();
  const amount = useEliminationAmount();
  const line = eliminationLine(progress);
  if (line.kind !== 'live') return null;
  const { status, unit, share } = line;
  return (
    <span className="mt-1 flex flex-col gap-1">
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <EliminationStatusPill status={status} />
        <span className="text-sm text-muted tabular-nums">
          {t('leaderboard.elimination.progress', {
            done: amount(line.done, unit),
            minimum: amount(line.minimum, unit),
          })}
        </span>
      </span>
      {/* The figures are written next to it. */}
      <span aria-hidden="true" className="block h-1.5 overflow-hidden rounded-full bg-track">
        <span
          className={`block h-full rounded-full ${STATUS_BARS[status]}`}
          style={{ width: `${share * 100}%` }}
        />
      </span>
    </span>
  );
}

/**
 * Context of the elimination, above its ranking (the end of the week is in
 * the page's banner): that week 1 eliminates no one, and how the minimum
 * moves (the server applies it; only X is shown here).
 */
export function EliminationContext({ challenge }: { challenge: ChallengeDetail }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const step = challenge.categories.find((category) => category.type === 'elimination')?.params
    .step_meters;
  return (
    <div className="mt-4 grid gap-1 text-sm text-muted">
      {challenge.current_week === 1 && <p>{t('leaderboard.elimination.firstWeek')}</p>}
      {step !== undefined && (
        <p>{t('leaderboard.elimination.rule', { step: formatKm(step / 1000, locale) })}</p>
      )}
    </div>
  );
}
