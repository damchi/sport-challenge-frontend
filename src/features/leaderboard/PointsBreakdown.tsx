import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  useParticipantPoints,
  type ChallengeDetail,
  type PointsCriterion,
  type PointsWeek,
} from '../../api/hooks/useChallenges';
import { Sheet } from '../../components/Sheet';
import { EmptyState } from '../../components/states/EmptyState';
import { ErrorState } from '../../components/states/ErrorState';
import { LoadingState } from '../../components/states/LoadingState';
import { challengePeriod, otherTimeZoneName } from '../../domain/format/challengeDates';
import { formatKm, formatMeters } from '../../domain/format/distance';
import { formatDuration } from '../../domain/format/duration';
import { useSportName } from '../challenges/create/useSportName';

/** The participant whose points are detailed, as the leaderboard names them. */
export interface PointsParticipant {
  userId: string;
  name: string;
  /** The signed-in user: « Tes points ». */
  me: boolean;
  /** Address of the participant's activities, for those who may open them. */
  href: string | undefined;
}

/**
 * Where the grand prix points of a participant come from, in a sheet over
 * the leaderboard: the weeks not locked yet apart from the acquired ones,
 * each with its criteria (the rank in the week's ranking, the value and the
 * points). Everything is the server's: nothing is ranked again here.
 */
export function PointsBreakdownSheet({
  challenge,
  participant,
  onClose,
}: {
  challenge: ChallengeDetail;
  participant: PointsParticipant | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const title = participant
    ? participant.me
      ? t('pointsBreakdown.titleMine')
      : t('pointsBreakdown.title', { name: participant.name })
    : '';
  return (
    <Sheet open={participant !== null} title={title} onClose={onClose}>
      {participant && <Breakdown challenge={challenge} participant={participant} />}
    </Sheet>
  );
}

function Breakdown({
  challenge,
  participant,
}: {
  challenge: ChallengeDetail;
  participant: PointsParticipant;
}) {
  const { t, i18n } = useTranslation();
  const points = useParticipantPoints(challenge.id, participant.userId);
  const locale = i18n.resolvedLanguage ?? 'fr';

  if (points.isPending) return <LoadingState />;
  if (!points.data) {
    return <ErrorState error={points.error} onRetry={() => void points.refetch()} />;
  }
  const { weeks, acquired_points, provisional_points, abandoned, frozen } = points.data;
  const provisional = weeks.filter((week) => !week.locked);
  const acquired = weeks.filter((week) => week.locked);
  const zone = otherTimeZoneName(
    challenge.timezone,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale,
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="font-display text-2xl font-bold tabular-nums">
          {t('pointsBreakdown.acquired', { count: acquired_points })}
        </p>
        {provisional_points !== null && provisional_points > 0 && (
          <p className="text-sm font-semibold text-muted tabular-nums">
            {t('leaderboard.provisional', { count: provisional_points })}
          </p>
        )}
        {/* Final, then whether only the points before abandoning count; else the rule. */}
        {(frozen || !abandoned) && (
          <p className="mt-2 text-sm text-muted">
            {frozen ? t('pointsBreakdown.frozen') : t('pointsBreakdown.rule')}
          </p>
        )}
        {abandoned && <p className="mt-2 text-sm text-muted">{t('pointsBreakdown.abandoned')}</p>}
        {zone && weeks.length > 0 && (
          <p className="mt-1 text-sm text-muted">{t('pointsBreakdown.zone', { zone })}</p>
        )}
      </div>

      {weeks.length === 0 ? (
        <EmptyState message={t('pointsBreakdown.empty')} />
      ) : (
        <>
          {provisional.length > 0 && (
            <WeekGroup
              title={t('pointsBreakdown.provisionalWeeks')}
              weeks={provisional}
              challenge={challenge}
            />
          )}
          {acquired.length > 0 && (
            <WeekGroup
              title={t('pointsBreakdown.acquiredWeeks')}
              weeks={acquired}
              challenge={challenge}
            />
          )}
        </>
      )}

      {participant.href && (
        <Link
          to={participant.href}
          className="flex h-11 items-center justify-center rounded-full border border-border bg-surface px-5 font-bold hover-fill"
        >
          {t('pointsBreakdown.activities')}
        </Link>
      )}
    </div>
  );
}

function WeekGroup({
  title,
  weeks,
  challenge,
}: {
  title: string;
  weeks: PointsWeek[];
  challenge: ChallengeDetail;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="text-sm font-bold text-muted uppercase">
        {title}
      </h3>
      <ol className="mt-2 grid grid-cols-1 gap-2">
        {weeks.map((week) => (
          <li key={week.number}>
            <Week week={week} challenge={challenge} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function Week({ week, challenge }: { week: PointsWeek; challenge: ChallengeDetail }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const { start, end } = challengePeriod(week.starts_at, week.ends_at, challenge.timezone, locale);
  const heading = t('pointsBreakdown.week', { week: week.number });
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="rounded-row border border-border p-3">
      <div className="flex items-baseline gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <h4 id={headingId} className="font-semibold">
            {heading}
          </h4>
          <span className="text-sm text-muted">
            {t('pointsBreakdown.weekDates', { start, end })}
          </span>
        </div>
        <span className="shrink-0 font-bold tabular-nums">
          {week.locked
            ? t('leaderboard.points', { count: week.points })
            : t('pointsBreakdown.provisionalPoints', { count: week.points })}
        </span>
      </div>
      <ul className="mt-1 flex flex-col">
        {week.criteria.map((criterion) => (
          <li key={criterion.criterion} className="py-2">
            <Criterion criterion={criterion} referenceSport={challenge.reference_sport} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Criterion({
  criterion,
  referenceSport,
}: {
  criterion: PointsCriterion;
  referenceSport: string;
}) {
  const { t } = useTranslation();
  const value = useCriterionValue(criterion, referenceSport);
  // A value of 0 does not score: no rank in the week's ranking.
  const rank =
    criterion.rank === null
      ? t('pointsBreakdown.unranked')
      : t('pointsBreakdown.rank', {
          rank: t('leaderboard.rank', { count: criterion.rank, ordinal: true }),
        });
  return (
    <div className="flex items-baseline gap-3 text-sm">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold">
          {t(`challengeDetail.categories.pointsParams.criteria.${criterion.criterion}`)}
        </span>
        <span className="text-muted">{value ? `${value} · ${rank}` : rank}</span>
      </span>
      <span
        className={`shrink-0 tabular-nums ${criterion.points > 0 ? 'font-bold' : 'text-muted'}`}
      >
        {t('leaderboard.points', { count: criterion.points })}
      </span>
    </div>
  );
}

/**
 * The value of a criterion: h:mm, km equivalent to the reference sport,
 * sessions, or real meters climbed. None for a reader who may not see the
 * participants' activities (the server gives null).
 */
function useCriterionValue(criterion: PointsCriterion, referenceSport: string): string | null {
  const { t, i18n } = useTranslation();
  const sportName = useSportName();
  const { value } = criterion;
  if (value === null) return null;
  const locale = i18n.resolvedLanguage ?? 'fr';
  switch (criterion.criterion) {
    case 'longest_duration':
      return formatDuration(value);
    case 'longest_distance':
      return t('leaderboard.equivalent', {
        distance: formatKm(value / 1000, locale),
        sport: sportName(referenceSport).toLocaleLowerCase(locale),
      });
    case 'session_count':
      return t('activities.sessions', { count: value });
    case 'weekly_elevation':
      return t('leaderboard.elevation', { elevation: formatMeters(value, locale) });
  }
}
