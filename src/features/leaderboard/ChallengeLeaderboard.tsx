import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router';
import {
  useCategoryLeaderboard,
  useChallenge,
  useLeaderboard,
  type CategoryType,
  type ChallengeDetail,
  type LeaderboardEntry,
} from '../../api/hooks/useChallenges';
import { useFetchAllPages } from '../../api/hooks/useFetchAllPages';
import { useMe } from '../../api/hooks/useMe';
import { LoadMore } from '../../components/LoadMore';
import { PageSizeChoice } from '../../components/PageSizeChoice';
import { EmptyState } from '../../components/states/EmptyState';
import { ErrorState } from '../../components/states/ErrorState';
import { LoadingState } from '../../components/states/LoadingState';
import { canSeeParticipantActivities } from '../../domain/challenge';
import { timeZoneName } from '../../domain/format/challengeDates';
import { sharedRanks } from '../../domain/format/rank';
import type { PageSize } from '../../domain/pageSize';
import { usePageSize } from '../../lib/pageSize';
import { useSportName } from '../challenges/create/useSportName';
import { categoryExplanation, useCategoryName } from '../challenges/detail/categoryNames';
import { isOut } from '../../domain/rankingChanges';
import { EliminationContext } from './EliminationProgress';
import { LeaderboardRow, OutRow, PodiumCard } from './LeaderboardEntries';
import { PointsBreakdownSheet, type PointsParticipant } from './PointsBreakdown';
import { hasStandings, myLines, shownCategory } from './shownCategory';

const SEGMENT =
  'min-h-11 min-w-fit flex-1 rounded-tab px-2 py-1 text-sm leading-tight font-semibold';
const SEGMENT_ON = 'bg-segment-active text-ink shadow-[0_1px_3px_rgba(22,24,29,.12)]';
const SEGMENT_OFF = 'text-muted hover-ink';
// A long ranking (no cap on participants) stays fast: the browser skips the
// rendering of the rows off screen, which stay in the page (find, screen readers).
// It clips the painting to the row: 4 px of padding, taken back by the margin,
// keep the focus ring (2 px, 2 px away) whole.
const OFFSCREEN_ROW = '-m-1 p-1 [content-visibility:auto] [contain-intrinsic-size:auto_4rem]';

/**
 * Leaderboard tab of a challenge: one category at a time, among the 1 to 5
 * the challenge has (its choice lives in the address, ?category=, set by
 * the cards of « Où tu en es »; without them, by a selector here, and no
 * choice with a single category), with what it ranks, its podium (ranks 1
 * to 3, ties included, always whole), then the rest of its ranking, 10, 50 or
 * every line after the podium (one choice for every category, kept on the
 * device), and, apart, the participants who abandoned or, in the
 * elimination, were eliminated. Ranks, order and statuses are the server's.
 * The user's row stands out and stays on screen, even before the page that
 * holds it is loaded. No live update in V1: the page's banner says when the
 * server computed it, or that the results are final.
 * Rendered under the challenge page, which has already loaded the challenge.
 */
export function ChallengeLeaderboard() {
  const { challengeId = '' } = useParams();
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const challenge = useChallenge(challengeId);
  // The whole leaderboard of « Où tu en es » (shared with it): whether its cards show.
  const leaderboard = useLeaderboard(challengeId);
  const me = useMe();
  const [size, setSize] = usePageSize('leaderboard');
  // A hook comes before the early returns; the name is only read once the
  // challenge has loaded, so the fallback never shows.
  const categoryName = useCategoryName(challenge.data?.reference_sport ?? 'run');
  const sportName = useSportName();

  if (!challenge.data) return null;
  const { categories } = challenge.data;
  const category = shownCategory(categories, params.get('category'));
  if (!category) return <EmptyState message={t('leaderboard.empty')} />;

  const name = categoryName(category.type, category.params.exercise);
  // The cards of « Où tu en es », when the page shows them, choose the category.
  // While they load, no selector: it would show, then give way to them.
  const cardsChoose =
    hasStandings(challenge.data) &&
    (leaderboard.isPending ||
      me.isPending ||
      myLines(leaderboard.data?.categories ?? [], me.data?.id).length > 0);

  const choose = (type: string) => {
    const next = new URLSearchParams(params);
    next.set('category', type);
    setParams(next, { replace: true });
  };

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
          {categories.map(({ type, params: { exercise } }) => (
            <button
              key={type}
              type="button"
              aria-pressed={type === category.type}
              onClick={() => choose(type)}
              className={`${SEGMENT} ${type === category.type ? SEGMENT_ON : SEGMENT_OFF}`}
            >
              {categoryName(type, exercise)}
            </button>
          ))}
        </div>
      )}
      <h2 id="leaderboard-title" className="font-display text-lg font-bold">
        {t('leaderboard.title', { category: name })}
      </h2>
      <p className="mt-1 text-sm text-muted">
        {t(categoryExplanation(category.type, category.params.exercise), {
          sport: sportName(challenge.data.reference_sport),
        })}
      </p>

      <CategoryLeaderboard
        // Its own state (the participant detailed) belongs to one category.
        key={category.type}
        challenge={challenge.data}
        type={category.type}
        myId={me.data?.id}
        size={size}
        onSize={setSize}
      />
    </section>
  );
}

/**
 * The ranking of one category: its podium, whole on every page, the lines
 * after it page by page, and the user's line, from `me`, while the page that
 * holds it is not loaded yet (never twice).
 */
function CategoryLeaderboard({
  challenge,
  type,
  myId,
  size,
  onSize,
}: {
  challenge: ChallengeDetail;
  type: CategoryType;
  myId: string | undefined;
  size: PageSize;
  onSize: (size: PageSize) => void;
}) {
  const { t, i18n } = useTranslation();
  const ranking = useCategoryLeaderboard(challenge.id, type, size);
  useFetchAllPages(ranking, size === 'all');

  const pages = ranking.data?.pages;
  const first = pages?.[0];
  const podiumLines = first?.podium ?? [];
  const lines = pages?.flatMap((page) => page.entries) ?? [];
  const empty = first !== undefined && podiumLines.length === 0 && lines.length === 0;

  // Eliminated ones follow the survivors, abandoned ones come last (server's order).
  const loaded = [...podiumLines, ...lines];
  const mine = first?.me ?? null;
  // An elimination by repetitions: its values are repetitions of that exercise.
  const exercise = challenge.categories.find((category) => category.type === type)?.params.exercise;
  // Not loaded yet: shown after the loaded lines it comes after, until its page is.
  const apart = mine && !loaded.some((entry) => entry.user.id === mine.user.id) ? mine : null;
  // An eliminated one keeps out of the podium, even at the end (decision of 2026-11-20).
  const podium = podiumLines.filter((entry) => !isOut(entry));
  const rest = [
    ...lines.filter((entry) => !isOut(entry)),
    ...(apart && !isOut(apart) ? [apart] : []),
  ];
  const out = [
    ...podiumLines.filter(isOut),
    ...lines.filter(isOut),
    ...(apart && isOut(apart) ? [apart] : []),
  ];
  // « ex æquo » among the loaded lines: a tie with a line not loaded yet is
  // noted once its page is (the rank itself is always the server's).
  const ties = sharedRanks([...podium, ...rest].map((entry) => entry.rank));
  const linked = canSeeParticipantActivities(challenge.my_role);
  // Grand prix: an entry opens where its points come from (the activities
  // are reached from there); the other categories link to the activities.
  const [detailed, setDetailed] = useState<PointsParticipant | null>(null);
  const activitiesOf = (userId: string) =>
    linked ? `/challenges/${challenge.id}/participants/${userId}` : undefined;
  const rowProps = (entry: LeaderboardEntry) => {
    const userId = entry.user.id;
    const me = userId === myId;
    const href = activitiesOf(userId);
    if (type !== 'points') return { type, me, href };
    return {
      type,
      me,
      href: undefined,
      onOpen: (name: string) => setDetailed({ userId, name, me, href }),
    };
  };
  const locale = i18n.resolvedLanguage ?? 'fr';

  return (
    <>
      {/* While the server still gives provisional points: until the last
          week locks, after the challenge's end too. */}
      {type === 'points' &&
        [...loaded, ...(mine ? [mine] : [])].some((entry) => entry.provisional_points !== null) && (
          <p className="mt-4 text-sm text-muted">
            {t('leaderboard.pointsRule', { zone: timeZoneName(challenge.timezone, locale) })}
          </p>
        )}

      {/* Only during the weeks of the challenge: the minimum then applies. */}
      {type === 'elimination' && challenge.current_week !== null && (
        <EliminationContext challenge={challenge} />
      )}

      {/* Kept while the ranking reloads in its new size (the focus stays on
          it); hidden when it failed or ranks no one. */}
      {(ranking.isPending || (first && !empty)) && (
        <div className="mt-4">
          <PageSizeChoice size={size} onChange={onSize} />
        </div>
      )}

      {ranking.isPending ? (
        <LoadingState />
      ) : !first ? (
        // Nothing loaded: the ranking failed (a failed "load more" keeps it).
        <div className="mt-4">
          <ErrorState error={ranking.error} onRetry={() => void ranking.refetch()} />
        </div>
      ) : empty ? (
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
                      referenceSport={challenge.reference_sport}
                      exercise={exercise}
                      tied={ties.has(entry.rank ?? 0)}
                      {...rowProps(entry)}
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
                  const props = rowProps(entry);
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
                        referenceSport={challenge.reference_sport}
                        exercise={exercise}
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
                    <OutRow entry={entry} {...rowProps(entry)} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <LoadMore
            hasMore={ranking.hasNextPage}
            loading={ranking.isFetchingNextPage}
            // While every page is read, a failed reload also stops the reading.
            failed={ranking.isFetchNextPageError || (size === 'all' && ranking.isError)}
            auto={size === 'all'}
            onLoadMore={() => void ranking.fetchNextPage()}
          />

          {type === 'points' && (
            <PointsBreakdownSheet
              challenge={challenge}
              participant={detailed}
              onClose={() => setDetailed(null)}
            />
          )}
        </>
      )}
    </>
  );
}
