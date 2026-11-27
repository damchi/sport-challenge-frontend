import { Award, Ban, CalendarDays, Timer, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { ChallengeSummary } from '../../api/hooks/useChallenges';
import { StatusPill } from '../../components/StatusPill';
import {
  challengeLastDay,
  challengePeriod,
  challengeStartDay,
  challengeWeekEnd,
  daysUntil,
  otherTimeZoneName,
} from '../../domain/format/challengeDates';
import { useCategoryName } from './detail/categoryNames';
import { MyWeekRows } from './MyWeekRows';

const CARD = 'flex h-full flex-col rounded-card p-4 lg:p-5';
const CARD_HOVER = 'hover-border';

/**
 * A challenge of the home page, as its status (the server's) shows it.
 * Ongoing: the week and its end for everyone, then the user's line in each
 * category while they take part (my_week). Upcoming: the start and the days left.
 * Finished: the user's best frozen rank (best_result). Every card ends with
 * its visibility, participants and the user's role; its dates are in the
 * challenge's time zone, named when the user's differs.
 */
export function ChallengeCard({ challenge }: { challenge: ChallengeSummary }) {
  const { t } = useTranslation();
  const atRisk =
    challenge.my_week?.rankings.some((ranking) => ranking.elimination?.status === 'at_risk') ??
    false;
  const border = atRisk
    ? 'border-2 border-risk-border bg-surface'
    : challenge.status === 'finished'
      ? `border border-border ${CARD_HOVER}`
      : `border border-border bg-surface ${CARD_HOVER}`;

  return (
    <Link to={`/challenges/${challenge.id}`} className={`${CARD} ${border}`}>
      {/* The pill sits beside the title, under it when the text is enlarged. */}
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <h3 className="min-w-0 flex-1 basis-32 font-display text-lg font-bold break-words">
          {challenge.title}
        </h3>
        {atRisk ? (
          <StatusPill
            label={t('leaderboard.elimination.at_risk')}
            Icon={TriangleAlert}
            tone="risk"
          />
        ) : (
          challenge.my_status === 'abandoned' && (
            <StatusPill
              label={
                <>
                  <span className="md:hidden">{t('challenges.card.abandonedShort')}</span>
                  <span className="hidden md:inline">{t('challenges.card.abandoned')}</span>
                </>
              }
              Icon={Ban}
              tone="out"
            />
          )
        )}
      </div>
      {challenge.status === 'ongoing' && <OngoingBody challenge={challenge} />}
      {challenge.status === 'upcoming' && <UpcomingBody challenge={challenge} />}
      {challenge.status === 'finished' && <FinishedBody challenge={challenge} />}
    </Link>
  );
}

/** "Public · 8 participants · tu l'as créé", after what a status puts first. */
function Meta({ challenge, first }: { challenge: ChallengeSummary; first?: string }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const zone = otherTimeZoneName(
    challenge.timezone,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale,
  );
  const role =
    challenge.my_role === 'creator'
      ? t('challenges.card.creator')
      : challenge.my_role === 'participant'
        ? t('challenges.card.participant')
        : undefined;
  const parts = [
    first,
    zone,
    t(`challenges.visibility.${challenge.visibility}`),
    t('challenges.participants', { count: challenge.participant_count }),
    role,
  ].filter((part): part is string => Boolean(part));
  return <p className="mt-2 text-sm text-muted">{parts.join(' · ')}</p>;
}

/**
 * The current week of the challenge in a dark banner, for everyone (the
 * server's current_week and week_ends_at), then the user's lines while they
 * take part (my_week).
 */
function OngoingBody({ challenge }: { challenge: ChallengeSummary }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const { current_week: week, week_ends_at: weekEndsAt } = challenge;
  const banner = (weekday: 'long' | 'short') =>
    week !== null &&
    weekEndsAt !== null &&
    t(weekday === 'long' ? 'challenges.card.week' : 'challenges.card.weekShort', {
      week,
      count: challenge.week_count,
      date: challengeWeekEnd(weekEndsAt, challenge.timezone, locale, weekday),
    });
  return (
    <>
      <Meta challenge={challenge} />
      {week !== null && weekEndsAt !== null && (
        <p className="mt-4 flex items-start gap-3 rounded-row border border-raised-border bg-surface-raised px-4 py-3 text-sm font-bold text-on-raised">
          <Timer
            aria-hidden="true"
            size={18}
            strokeWidth={2}
            className="mt-0.5 flex-none text-accent"
          />
          <span className="md:hidden">{banner('short')}</span>
          <span className="hidden md:inline">{banner('long')}</span>
        </p>
      )}
      {challenge.my_week && (
        <MyWeekRows
          week={challenge.my_week}
          referenceSport={challenge.reference_sport}
          exercise={challenge.exercise}
        />
      )}
    </>
  );
}

/** The first day and the days left before it, then the period. */
function UpcomingBody({ challenge }: { challenge: ChallengeSummary }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const { timezone } = challenge;
  const date = challengeStartDay(challenge.starts_at, timezone, locale);
  const days = daysUntil(new Date(), challenge.starts_at, timezone);
  return (
    <>
      <Highlight Icon={CalendarDays} iconClass="text-accent">
        {days === 0
          ? t('challenges.card.startsToday', { date })
          : t('challenges.card.startsIn', { date, count: days })}
      </Highlight>
      <Meta
        challenge={challenge}
        first={t(
          'challenges.period',
          challengePeriod(challenge.starts_at, challenge.ends_at, timezone, locale),
        )}
      />
    </>
  );
}

/** The user's best frozen rank, when the server gives one, then the last day. */
function FinishedBody({ challenge }: { challenge: ChallengeSummary }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const categoryName = useCategoryName(challenge.reference_sport);
  const best = challenge.best_result;
  return (
    <>
      {best && (
        <Highlight Icon={Award} iconClass="text-ok-fg">
          {t('challenges.card.bestResult', {
            rank: t('leaderboard.rank', { count: best.rank, ordinal: true }),
            // Inside a sentence: "2e en distance cumulée", but "1er en Grand prix"
            // and "1er en D+ cumulé" (an abbreviation keeps its capitals).
            category:
              best.type === 'points'
                ? categoryName(best.type)
                : best.type === 'cumulative_elevation'
                  ? t('challengeDetail.categories.elevationInSentence')
                  : categoryName(best.type).toLocaleLowerCase(locale),
          })}
          <span className="hidden md:inline"> · {t('challenges.card.bestResultNote')}</span>
        </Highlight>
      )}
      <Meta
        challenge={challenge}
        first={t('challenges.card.ended', {
          date: challengeLastDay(challenge.ends_at, challenge.timezone, locale),
        })}
      />
    </>
  );
}

function Highlight({
  Icon,
  iconClass,
  children,
}: {
  Icon: typeof Award;
  iconClass: string;
  children: ReactNode;
}) {
  return (
    <p className="mt-3 flex items-start gap-2 font-bold">
      <Icon
        aria-hidden="true"
        size={20}
        strokeWidth={2}
        className={`mt-0.5 flex-none ${iconClass}`}
      />
      <span>{children}</span>
    </p>
  );
}
