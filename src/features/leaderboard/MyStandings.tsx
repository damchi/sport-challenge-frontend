import { Flag, Route, Star, Timer, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useMatch, useSearchParams } from 'react-router';
import {
  useLeaderboard,
  type ChallengeDetail,
  type Leaderboard,
  type LeaderboardEntry,
} from '../../api/hooks/useChallenges';
import { useMe } from '../../api/hooks/useMe';
import { formatKm } from '../../domain/format/distance';
import { formatDuration } from '../../domain/format/duration';
import { useCategoryName } from '../challenges/detail/categoryNames';
import { useSportName } from '../challenges/create/useSportName';
import { EliminationStatusPill } from './EliminationProgress';
import { minimumShare, STATUS_BARS } from './eliminationWeek';
import { hasStandings, myLines, shownCategory } from './shownCategory';

type CategoryRanking = Leaderboard['categories'][number];
type CategoryType = CategoryRanking['type'];

const ICONS: Record<CategoryType, LucideIcon> = {
  cumulative_time: Timer,
  cumulative_distance: Route,
  elimination: Flag,
  points: Star,
};

const CARD = 'flex h-full min-h-40 flex-col gap-1 rounded-card p-4';
const CARD_ON = 'border-2 border-accent bg-accent-soft';
const CARD_RISK = 'border-2 border-risk-border bg-surface';
const CARD_OFF = 'border border-border bg-surface';

/**
 * « Où tu en es »: the user's line in each category of a challenge, in their
 * order, for an active participant of a started challenge (hasStandings).
 * Each card is a link to the leaderboard of its category; the one the
 * leaderboard shows stands out (aria-current). Every figure is the
 * server's: value, rank among the ranked ones, the elimination's week and
 * status, the provisional points. A phone scrolls the cards sideways.
 */
export function MyStandings({ challenge }: { challenge: ChallengeDetail }) {
  const { t } = useTranslation();
  const leaderboard = useLeaderboard(challenge.id);
  const me = useMe();
  const [params] = useSearchParams();
  // The leaderboard is the challenge's first section, at its own address.
  const onLeaderboard = useMatch('/challenges/:challengeId') !== null;

  // Loading or failed: the leaderboard below says so.
  if (!hasStandings(challenge) || !leaderboard.data || !me.data) return null;
  const { categories } = leaderboard.data;
  const shown = onLeaderboard ? shownCategory(categories, params.get('category'))?.type : undefined;
  const cards = myLines(categories, me.data.id);
  if (cards.length === 0) return null;

  return (
    <section aria-labelledby="my-standings" className="mt-6">
      <h2 id="my-standings" className="font-display text-lg font-bold">
        {t('standings.title')}
      </h2>
      {/* The padding keeps the focus ring whole inside the scrolling row. */}
      <ul className="-mx-5 mt-3 flex snap-x scroll-px-5 gap-3 overflow-x-auto px-5 py-1 md:mx-0 md:grid md:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] md:overflow-visible md:px-0">
        {cards.map(({ category, entry }) => (
          <li
            key={category.type}
            className="w-[80%] max-w-72 flex-none snap-start md:w-auto md:max-w-none"
          >
            <Link
              to={`/challenges/${challenge.id}?category=${category.type}`}
              aria-current={category.type === shown ? 'true' : undefined}
              className={`${CARD} ${
                category.type === shown
                  ? CARD_ON
                  : entry.elimination?.status === 'at_risk'
                    ? CARD_RISK
                    : CARD_OFF
              }`}
            >
              <StandingCard
                category={category}
                entry={entry}
                referenceSport={challenge.reference_sport}
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StandingCard({
  category,
  entry,
  referenceSport,
}: {
  category: CategoryRanking;
  entry: LeaderboardEntry;
  referenceSport: string;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const categoryName = useCategoryName(referenceSport);
  const sportName = useSportName();
  // Inside a sentence: "en équivalent course".
  const sport = sportName(referenceSport).toLocaleLowerCase(locale);
  const Icon = ICONS[category.type];
  const elimination = entry.elimination;
  const status =
    elimination?.status && elimination.status !== 'eliminated' ? elimination.status : null;
  const km = (meters: number) => formatKm(meters / 1000, locale);

  let value = '';
  let detail: string | null = null;
  if (entry.value !== null) {
    if (category.type === 'cumulative_time') {
      value = formatDuration(entry.value);
      detail = t('standings.time');
    } else if (category.type === 'cumulative_distance') {
      value = km(entry.value);
      detail = t('standings.distance', { sport });
    } else if (category.type === 'points') {
      value = t('leaderboard.points', { count: entry.value });
      detail = entry.provisional_points
        ? t('leaderboard.provisional', { count: entry.provisional_points })
        : null;
    }
  }
  if (category.type === 'elimination' && elimination) {
    // During a week with a minimum, the distance of this week against it;
    // else (week 1, eliminated, after the end) the total, as ranked.
    const minimum = status ? elimination.minimum_meters : null;
    value =
      minimum === null
        ? entry.value === null
          ? ''
          : km(entry.value)
        : t('standings.eliminationValue', {
            done: km(elimination.distance_meters),
            minimum: km(minimum),
          });
    detail = t(minimum === null ? 'standings.elimination' : 'standings.eliminationWeek', {
      sport,
    });
  }

  const eliminatedWeek = elimination?.eliminated_week ?? null;
  return (
    <>
      <span className="flex items-center gap-2 text-xs font-bold tracking-wide text-muted uppercase">
        <Icon aria-hidden="true" size={16} strokeWidth={2} className="flex-none" />
        {categoryName(category.type)}
      </span>
      <span className="mt-1 font-display text-3xl font-bold tabular-nums">{value}</span>
      {detail && <span className="text-sm text-muted">{detail}</span>}
      {status && elimination && elimination.minimum_meters !== null && (
        // The figures are written above.
        <span aria-hidden="true" className="mt-1 block h-2.5 overflow-hidden rounded-full bg-track">
          <span
            className={`block h-full rounded-full ${STATUS_BARS[status]}`}
            style={{ width: `${minimumShare(elimination) * 100}%` }}
          />
        </span>
      )}
      <span className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3 font-bold">
        {eliminatedWeek !== null
          ? t('leaderboard.eliminated', { week: eliminatedWeek })
          : entry.rank !== null &&
            t('challenges.rank', {
              rank: t('leaderboard.rank', { count: entry.rank, ordinal: true }),
              count: category.ranked_count,
            })}
        {status && status !== 'in_progress' && <EliminationStatusPill status={status} />}
      </span>
    </>
  );
}
