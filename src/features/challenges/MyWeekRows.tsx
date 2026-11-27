import { useTranslation } from 'react-i18next';
import type { ChallengeSummary } from '../../api/hooks/useChallenges';
import { EliminationStatusPill } from '../leaderboard/EliminationProgress';
import { eliminationLine, STATUS_BARS } from '../leaderboard/eliminationWeek';
import { useEliminationAmount } from '../leaderboard/useEntryValue';
import { useCategoryName } from './detail/categoryNames';

type MyWeek = NonNullable<ChallengeSummary['my_week']>;
type MyRanking = MyWeek['rankings'][number];

/**
 * The user's line in each category of an ongoing challenge, on its card:
 * the category, then the rank among the ranked ones ("4e sur 8"); the
 * elimination shows the week's distance (or repetitions) against its
 * minimum, with its status and a bar, or the amount alone in week 1; the points add the
 * provisional ones. Every value is the server's (my_week).
 */
export function MyWeekRows({ week, referenceSport }: { week: MyWeek; referenceSport: string }) {
  const categoryName = useCategoryName(referenceSport);
  return (
    <ul className="mt-4">
      {week.rankings.map((ranking) => (
        <li key={ranking.type} className="border-t border-border py-3 last:pb-0">
          <RankingRow ranking={ranking} name={categoryName(ranking.type)} />
        </li>
      ))}
    </ul>
  );
}

function RankingRow({ ranking, name }: { ranking: MyRanking; name: string }) {
  const { t } = useTranslation();
  const amount = useEliminationAmount();
  const elimination = ranking.elimination;
  const rank = t('challenges.rank', {
    rank: t('leaderboard.rank', { count: ranking.rank, ordinal: true }),
    count: ranking.ranked_count,
  });

  const line = elimination ? eliminationLine(elimination) : null;
  let value = rank;
  let detail: string | null = ranking.provisional_points
    ? t('leaderboard.provisional', { count: ranking.provisional_points })
    : null;
  const live = line?.kind === 'live' ? line : null;
  if (line?.kind === 'eliminated') {
    // Out of its ranking, as in the leaderboard.
    value = t('leaderboard.eliminated', { week: line.week });
  } else if (line?.kind === 'live') {
    value = t('standings.eliminationValue', {
      done: amount(line.done, line.unit),
      minimum: amount(line.minimum, line.unit),
    });
  } else if (line?.kind === 'distance') {
    value = amount(line.done, line.unit);
    detail = t('challenges.card.noEliminationWeek1');
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
