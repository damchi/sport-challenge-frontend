import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router';
import { useChallenge, useLeaderboard, type LeaderboardEntry } from '../../api/hooks/useChallenges';
import { useMe } from '../../api/hooks/useMe';
import { EmptyState } from '../../components/states/EmptyState';
import { ErrorState } from '../../components/states/ErrorState';
import { LoadingState } from '../../components/states/LoadingState';
import { canSeeParticipantActivities } from '../../domain/challenge';
import { timeZoneName } from '../../domain/format/challengeDates';
import { sharedRanks } from '../../domain/format/rank';
import { useSportName } from '../challenges/create/useSportName';
import { CATEGORY_EXPLANATIONS, useCategoryName } from '../challenges/detail/categoryNames';
import { EliminationContext } from './EliminationProgress';
import { LeaderboardRow, OutRow, PodiumCard } from './LeaderboardEntries';
import { hasStandings, myLines, shownCategory } from './shownCategory';

const SEGMENT =
  'min-h-11 min-w-fit flex-1 rounded-tab px-2 py-1 text-sm leading-tight font-semibold';
const SEGMENT_ON = 'bg-segment-active text-ink shadow-[0_1px_3px_rgba(22,24,29,.12)]';
const SEGMENT_OFF = 'text-muted';
// A long ranking (no cap on participants) stays fast: the browser skips the
// rendering of the rows off screen, which stay in the page (find, screen readers).
// It clips the painting to the row: 4 px of padding, taken back by the margin,
// keep the focus ring (2 px, 2 px away) whole.
const OFFSCREEN_ROW = '-m-1 p-1 [content-visibility:auto] [contain-intrinsic-size:auto_4rem]';

/**
 * Leaderboard tab of a challenge: one category at a time, among the 1 to 4
 * the challenge has (its choice lives in the address, ?category=, set by
 * the cards of « Où tu en es »; without them, by a selector here, and no
 * choice with a single category), with what it ranks, its podium (ranks 1
 * to 3, ties included), the rest of its ranking and, apart, the
 * participants who abandoned or, in the elimination, were eliminated.
 * Ranks, order and statuses are the server's. The user's row stands out
 * and stays on screen. No live update in V1: the page's banner says when
 * the server computed it, or that the results are final.
 * Rendered under the challenge page, which has already loaded the challenge.
 */
export function ChallengeLeaderboard() {
  const { challengeId = '' } = useParams();
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const challenge = useChallenge(challengeId);
  const leaderboard = useLeaderboard(challengeId);
  const me = useMe();
  // A hook comes before the early returns; the name is only read once the
  // challenge has loaded, so the fallback never shows.
  const categoryName = useCategoryName(challenge.data?.reference_sport ?? 'run');
  const sportName = useSportName();

  if (!challenge.data) return null;
  if (leaderboard.isPending) return <LoadingState />;
  if (!leaderboard.data) {
    return <ErrorState error={leaderboard.error} onRetry={() => void leaderboard.refetch()} />;
  }

  const { categories } = leaderboard.data;
  const category = shownCategory(categories, params.get('category'));
  if (!category) return <EmptyState message={t('leaderboard.empty')} />;

  const locale = i18n.resolvedLanguage ?? 'fr';
  const { timezone } = challenge.data;
  const name = categoryName(category.type);
  // The cards of « Où tu en es », when the page shows them, choose the category.
  const cardsChoose = hasStandings(challenge.data) && myLines(categories, me.data?.id).length > 0;

  const choose = (type: string) => {
    const next = new URLSearchParams(params);
    next.set('category', type);
    setParams(next, { replace: true });
  };
  // Eliminated ones follow the survivors, abandoned ones come last (server's order).
  const isOut = (entry: LeaderboardEntry) =>
    entry.abandoned || (entry.elimination?.eliminated_week ?? null) !== null;
  const ranked = category.entries.filter((entry) => !isOut(entry));
  const out = category.entries.filter(isOut);
  const onPodium = (entry: LeaderboardEntry) => entry.rank !== null && entry.rank <= 3;
  const podium = ranked.filter(onPodium);
  const rest = ranked.filter((entry) => !onPodium(entry));
  const ties = sharedRanks(ranked.map((entry) => entry.rank));
  const linked = canSeeParticipantActivities(challenge.data.my_role);
  const rowProps = (userId: string) => ({
    type: category.type,
    me: userId === me.data?.id,
    href: linked ? `/challenges/${challengeId}/participants/${userId}` : undefined,
  });

  return (
    <section
      aria-labelledby="leaderboard-title"
      className="rounded-card border border-border bg-surface p-3 md:p-4 lg:p-5"
    >
      {categories.length > 1 && !cardsChoose && (
        <div
          role="group"
          aria-label={t('leaderboard.categories')}
          // The categories share a line, and wrap when the text is enlarged.
          className="mb-4 flex flex-wrap rounded-row bg-segment p-1"
        >
          {categories.map(({ type }) => (
            <button
              key={type}
              type="button"
              aria-pressed={type === category.type}
              onClick={() => choose(type)}
              className={`${SEGMENT} ${type === category.type ? SEGMENT_ON : SEGMENT_OFF}`}
            >
              {categoryName(type)}
            </button>
          ))}
        </div>
      )}
      <h2 id="leaderboard-title" className="font-display text-lg font-bold">
        {t('leaderboard.title', { category: name })}
      </h2>
      <p className="mt-1 text-sm text-muted">
        {t(CATEGORY_EXPLANATIONS[category.type], {
          sport: sportName(challenge.data.reference_sport),
        })}
      </p>

      {/* While the server still gives provisional points: until the last
          week locks, after the challenge's end too. */}
      {category.type === 'points' &&
        category.entries.some((entry) => entry.provisional_points !== null) && (
          <p className="mt-4 text-sm text-muted">
            {t('leaderboard.pointsRule', { zone: timeZoneName(timezone, locale) })}
          </p>
        )}

      {/* Only during the weeks of the challenge: the minimum then applies. */}
      {category.type === 'elimination' && challenge.data.current_week !== null && (
        <EliminationContext challenge={challenge.data} />
      )}

      {category.entries.length === 0 ? (
        <div className="mt-4">
          <EmptyState message={t('leaderboard.empty')} />
        </div>
      ) : (
        <>
          {podium.length > 0 && (
            <section aria-labelledby="leaderboard-podium" className="mt-5">
              <h3 id="leaderboard-podium" className="text-sm font-bold text-muted uppercase">
                {t('leaderboard.podium')}
              </h3>
              <ol className="mt-2 grid grid-cols-3 gap-2">
                {podium.map((entry) => (
                  <li
                    key={entry.user.id}
                    // Three cards side by side at 360 px; ties add more, on a new row.
                    className="flex min-w-0"
                  >
                    <PodiumCard
                      entry={entry}
                      referenceSport={challenge.data.reference_sport}
                      tied={ties.has(entry.rank ?? 0)}
                      {...rowProps(entry.user.id)}
                    />
                  </li>
                ))}
              </ol>
            </section>
          )}

          {rest.length > 0 && (
            <section aria-labelledby="leaderboard-ranking" className="mt-6">
              <h3 id="leaderboard-ranking" className="text-sm font-bold text-muted uppercase">
                {t('leaderboard.ranking')}
              </h3>
              <ol className="mt-2 grid grid-cols-1 gap-2">
                {rest.map((entry) => {
                  const props = rowProps(entry.user.id);
                  return (
                    <li
                      key={entry.user.id}
                      // The user's row stays on screen, above the phone's bottom bar.
                      className={
                        props.me
                          ? 'sticky top-2 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[1] md:bottom-4'
                          : OFFSCREEN_ROW
                      }
                    >
                      <LeaderboardRow
                        entry={entry}
                        tied={ties.has(entry.rank ?? 0)}
                        referenceSport={challenge.data.reference_sport}
                        {...props}
                      />
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          {out.length > 0 && (
            <section aria-labelledby="leaderboard-out" className="mt-6">
              <h3 id="leaderboard-out" className="text-sm font-bold text-muted uppercase">
                {t('leaderboard.out')}
              </h3>
              <ul className="mt-2 grid grid-cols-1 gap-2">
                {out.map((entry) => (
                  <li key={entry.user.id} className={OFFSCREEN_ROW}>
                    <OutRow entry={entry} {...rowProps(entry.user.id)} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </section>
  );
}
