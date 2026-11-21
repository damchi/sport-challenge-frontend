import { Flag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router';
import { useChallenge, useLeaderboard, type LeaderboardEntry } from '../../api/hooks/useChallenges';
import { useMe } from '../../api/hooks/useMe';
import { EmptyState } from '../../components/states/EmptyState';
import { ErrorState } from '../../components/states/ErrorState';
import { LoadingState } from '../../components/states/LoadingState';
import { canSeeParticipantActivities } from '../../domain/challenge';
import {
  challengeLastDay,
  challengeTime,
  otherTimeZoneName,
} from '../../domain/format/challengeDates';
import { sharedRanks } from '../../domain/format/rank';
import { useCategoryName } from '../challenges/detail/categoryNames';
import { EliminationContext } from './EliminationProgress';
import { LeaderboardRow, OutRow, PodiumCard } from './LeaderboardEntries';

const SEGMENT = 'min-h-11 flex-1 rounded-tab px-2 py-1 text-sm leading-tight font-semibold';
const SEGMENT_ON = 'bg-segment-active text-ink shadow-[0_1px_3px_rgba(22,24,29,.12)]';
const SEGMENT_OFF = 'text-muted';

/**
 * Leaderboard tab of a challenge: one category at a time, among the 1 to 3
 * the challenge has (its choice lives in the address, ?category=; no choice
 * with a single category), with its podium (ranks 1 to 3, ties included),
 * its full ranking and, apart, the participants who abandoned or, in the
 * elimination, were eliminated. Ranks, order and statuses are the server's.
 * The user's row stands out and stays on screen. No live update in V1: it
 * says when the server computed it. Once the challenge is finished (the
 * server's status), its results are final: it says so, with its last day and year.
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

  if (!challenge.data) return null;
  if (leaderboard.isPending) return <LoadingState />;
  if (!leaderboard.data) {
    return <ErrorState error={leaderboard.error} onRetry={() => void leaderboard.refetch()} />;
  }

  const { categories, computed_at: computedAt } = leaderboard.data;
  const category =
    categories.find((candidate) => candidate.type === params.get('category')) ?? categories[0];
  if (!category) return <EmptyState message={t('leaderboard.empty')} />;

  const locale = i18n.resolvedLanguage ?? 'fr';
  const { timezone } = challenge.data;
  const zone = otherTimeZoneName(
    timezone,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale,
  );

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
  const podium = ranked.filter((entry) => entry.rank !== null && entry.rank <= 3);
  const ties = sharedRanks(ranked.map((entry) => entry.rank));
  const linked = canSeeParticipantActivities(challenge.data.my_role);
  const rowProps = (userId: string) => ({
    type: category.type,
    me: userId === me.data?.id,
    href: linked ? `/challenges/${challengeId}/participants/${userId}` : undefined,
  });

  return (
    <section aria-label={t('leaderboard.label')}>
      {categories.length > 1 ? (
        <div
          role="group"
          aria-label={t('leaderboard.categories')}
          className="flex rounded-row bg-segment p-1"
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
      ) : (
        <p className="font-semibold">{categoryName(category.type)}</p>
      )}

      {challenge.data.status === 'finished' ? (
        <p className="mt-3 flex items-start gap-2 text-sm font-semibold text-ink">
          <Flag aria-hidden="true" size={16} strokeWidth={2} className="mt-0.5 flex-none" />
          {t('leaderboard.final', {
            date: challengeLastDay(challenge.data.ends_at, timezone, locale),
            zone,
            context: zone && 'zone',
          })}
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted">
          {t('leaderboard.updated', {
            date: challengeTime(computedAt, timezone, locale),
            zone,
            context: zone && 'zone',
          })}
        </p>
      )}

      {/* Only during the weeks of the challenge: the minimum then applies. */}
      {category.type === 'elimination' && challenge.data.current_week !== null && (
        <EliminationContext challenge={challenge.data} weekEndsAt={challenge.data.week_ends_at} />
      )}

      {category.entries.length === 0 ? (
        <div className="mt-4">
          <EmptyState message={t('leaderboard.empty')} />
        </div>
      ) : (
        <>
          {podium.length > 0 && (
            <section aria-labelledby="leaderboard-podium" className="mt-5">
              <h2 id="leaderboard-podium" className="text-sm font-bold text-muted uppercase">
                {t('leaderboard.podium')}
              </h2>
              <ol className="mt-2 flex flex-wrap gap-2">
                {podium.map((entry) => (
                  <li
                    key={entry.user.id}
                    // Three cards side by side at 360 px; ties add more, which wrap.
                    className="flex min-w-0 flex-[1_1_6rem]"
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

          {ranked.length > 0 && (
            <section aria-labelledby="leaderboard-ranking" className="mt-6">
              <h2 id="leaderboard-ranking" className="text-sm font-bold text-muted uppercase">
                {t('leaderboard.ranking')}
              </h2>
              <ol className="mt-2 grid gap-2">
                {ranked.map((entry) => {
                  const props = rowProps(entry.user.id);
                  return (
                    <li
                      key={entry.user.id}
                      // The user's row stays on screen, above the phone's bottom bar.
                      className={
                        props.me
                          ? 'sticky top-2 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[1] md:bottom-4'
                          : undefined
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
              <h2 id="leaderboard-out" className="text-sm font-bold text-muted uppercase">
                {t('leaderboard.out')}
              </h2>
              <ul className="mt-2 grid gap-2">
                {out.map((entry) => (
                  <li key={entry.user.id}>
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
