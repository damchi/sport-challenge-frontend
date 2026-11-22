import { useTranslation } from 'react-i18next';
import type { ChallengeSummary } from '../../api/hooks/useChallenges';
import { formatKm } from '../../domain/format/distance';
import { EliminationStatusPill } from '../leaderboard/EliminationProgress';
import { minimumShare, STATUS_BARS, type LiveStatus } from '../leaderboard/eliminationWeek';
import { useCategoryName } from './detail/categoryNames';

type MyWeek = NonNullable<ChallengeSummary['my_week']>;
type MyRanking = MyWeek['rankings'][number];

/**
 * The user's line in each category of an ongoing challenge, on its card:
 * the category, then the rank among the ranked ones ("4e sur 8"); the
 * elimination shows the week's distance against its minimum, with its
 * status and a bar, or the distance alone in week 1; the points add the
 * provisional ones. Every value is the server's (my_week).
 */
export function MyWeekRows({ week, referenceSport }: { week: MyWeek; referenceSport: string }) {
  const categoryName = useCategoryName(referenceSport);
  return (
    <ul className="mt-4">
      {week.rankings.map((ranking) => (
        <li key={ranking.type} className="border-t border-border py-3 last:pb-0">
          <RankingRow ranking={ranking} week={week.week} name={categoryName(ranking.type)} />
        </li>
      ))}
    </ul>
  );
}

function RankingRow({ ranking, week, name }: { ranking: MyRanking; week: number; name: string }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const km = (meters: number) => formatKm(meters / 1000, locale);
  const elimination = ranking.elimination;
  const rank = t('challenges.rank', {
    rank: t('leaderboard.rank', { count: ranking.rank, ordinal: true }),
    count: ranking.ranked_count,
  });

  let value = rank;
  let detail: string | null = null;
  // A survivor's week against its minimum: its status and its bar.
  let live: { status: LiveStatus; share: number } | null = null;
  if (ranking.provisional_points) {
    detail = t('leaderboard.provisional', { count: ranking.provisional_points });
  }
  if (elimination) {
    const status =
      elimination.status && elimination.status !== 'eliminated' ? elimination.status : null;
    if (elimination.eliminated_week !== null) {
      // Out of its ranking, as in the leaderboard.
      value = t('leaderboard.eliminated', { week: elimination.eliminated_week });
    } else if (status && elimination.minimum_meters !== null) {
      value = t('standings.eliminationValue', {
        done: km(elimination.distance_meters),
        minimum: km(elimination.minimum_meters),
      });
      live = { status, share: minimumShare(elimination) };
    } else {
      // No minimum yet: the distance of the week.
      value = km(elimination.distance_meters);
      if (week === 1) detail = t('challenges.card.noEliminationWeek1');
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {/* The name keeps its width: the status and the value wrap below it instead. */}
      <span className="min-w-40 flex-1">{name}</span>
      {live && live.status !== 'in_progress' && <EliminationStatusPill status={live.status} />}
      <span className="font-bold tabular-nums">{value}</span>
      {live && (
        // The figures are written next to it.
        <span
          aria-hidden="true"
          className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-track"
        >
          <span
            className={`block h-full rounded-full ${STATUS_BARS[live.status]}`}
            style={{ width: `${live.share * 100}%` }}
          />
        </span>
      )}
      {detail && <span className="w-full text-sm text-muted">{detail}</span>}
    </div>
  );
}
