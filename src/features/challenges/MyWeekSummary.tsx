import { useTranslation } from 'react-i18next';
import type { ChallengeSummary } from '../../api/hooks/useChallenges';
import { challengeInstant, otherTimeZoneName } from '../../domain/format/challengeDates';
import { EliminationProgress } from '../leaderboard/EliminationProgress';
import { ProvisionalPoints } from '../leaderboard/ProvisionalPoints';
import { useCategoryName } from './detail/categoryNames';

type MyWeek = NonNullable<ChallengeSummary['my_week']>;

/**
 * The user's current week in a challenge of « Mes défis »: its number and
 * end in the challenge's time zone, then their rank in each category, as
 * "2e sur 6", with the elimination's progress and the provisional points;
 * once eliminated, the week of the elimination instead of the rank.
 * Every value is the server's, as in the leaderboard at the same instant.
 */
export function MyWeekSummary({ week, timeZone }: { week: MyWeek; timeZone: string }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  // The list gives no reference sport: the elimination keeps a generic name.
  const categoryName = useCategoryName(undefined);
  const zone = otherTimeZoneName(
    timeZone,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale,
  );

  return (
    // No landmark: it is read inside the card's link.
    <div className="mt-3 border-t border-border pt-3">
      <p className="text-sm font-semibold">
        {t('challengeDetail.week', { week: week.week })}
        <span className="block font-normal text-muted">
          {t('challengeDetail.weekEnds', {
            date: challengeInstant(week.week_ends_at, timeZone, locale),
            zone,
            context: zone && 'zone',
          })}
        </span>
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {week.rankings.map((ranking) => (
          <li key={ranking.type} className="flex items-start gap-3 text-sm">
            <span className="flex min-w-0 flex-1 flex-col">
              {categoryName(ranking.type)}
              {ranking.elimination && <EliminationProgress progress={ranking.elimination} />}
            </span>
            <span className="shrink-0 text-right font-bold tabular-nums">
              {/* Eliminated: out of its ranking, as in the leaderboard. */}
              {ranking.elimination?.eliminated_week
                ? t('leaderboard.eliminated', { week: ranking.elimination.eliminated_week })
                : t('challenges.rank', {
                    rank: t('leaderboard.rank', { count: ranking.rank, ordinal: true }),
                    count: ranking.ranked_count,
                  })}
              <ProvisionalPoints points={ranking.provisional_points} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
