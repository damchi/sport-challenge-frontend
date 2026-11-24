import { ArrowDown, ArrowRight, ArrowUp, Flag } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminChallenge } from '../../api/hooks/admin/useAdminChallenges';
import type {
  AdminChallengePreview,
  AdminCorrection,
  AdminEliminationChange,
} from '../../api/hooks/admin/useAdminCorrection';
import type { Leaderboard, LeaderboardEntry } from '../../api/hooks/useChallenges';
import { EmptyState } from '../../components/states/EmptyState';
import { ErrorState } from '../../components/states/ErrorState';
import { LoadingState } from '../../components/states/LoadingState';
import { displayName } from '../../domain/displayName';
import { formatKm } from '../../domain/format/distance';
import { sharedRanks } from '../../domain/format/rank';
import {
  categoryChanges,
  isOut,
  rankingChanges,
  type LineChange,
} from '../../domain/rankingChanges';
import { useCategoryName } from '../challenges/detail/categoryNames';
import { useEntryValue } from '../leaderboard/useEntryValue';
import { CELL } from './adminCells';

type CategoryRanking = Leaderboard['categories'][number];
type CategoryType = CategoryRanking['type'];

/** Ranks shared by more than one ranked participant (ties: 1, 1, 3). */
function tiesOf(category: CategoryRanking | null): Set<number> {
  return sharedRanks(
    (category?.entries ?? []).filter((entry) => !isOut(entry)).map((entry) => entry.rank),
  );
}

/** A name, or the words for an account that has none. */
function useName() {
  const { t } = useTranslation();
  return (user: Parameters<typeof displayName>[0]) =>
    displayName(user) ?? t('admin.challenges.unnamed');
}

/**
 * A place in the ranking as the leaderboard says it: the ordinal ("3e"),
 * noted when shared, or why the participant is out of it.
 */
function usePlace() {
  const { t } = useTranslation();
  return (entry: LeaderboardEntry | null, ties: Set<number>): string => {
    if (!entry) return t('admin.recompute.absent');
    if (isOut(entry)) {
      const week = entry.elimination?.eliminated_week;
      return entry.abandoned || !week
        ? t('leaderboard.abandoned')
        : t('leaderboard.eliminated', { week });
    }
    // No rank from the server: shown as out of the ranking, never made up.
    const rank = entry.rank;
    if (rank === null) return t('admin.recompute.absent');
    const ordinal = t('leaderboard.rank', { count: rank, ordinal: true });
    return ties.has(rank) ? `${ordinal} ${t('leaderboard.tied')}` : ordinal;
  };
}

/**
 * The rank column: the place alone when it stays, else "↑ 3e → 2e". The
 * arrows are for the eye; words, read by screen readers, say the move.
 */
function RankCell({
  change,
  tiesBefore,
  tiesAfter,
}: {
  change: LineChange<LeaderboardEntry>;
  tiesBefore: Set<number>;
  tiesAfter: Set<number>;
}) {
  const { t } = useTranslation();
  const place = usePlace();
  const before = place(change.before, tiesBefore);
  const after = place(change.after, tiesAfter);
  const move = change.move;
  if (!move) return <>{change.after ? after : before}</>;
  if (move.kind === 'same') return <>{after}</>;
  const up = move.kind === 'up' || move.kind === 'in';
  const Arrow = up ? ArrowUp : ArrowDown;
  return (
    <span
      className={`inline-flex flex-wrap items-center gap-1 font-bold ${up ? 'text-ok-fg' : 'text-risk-fg'}`}
    >
      <Arrow aria-hidden="true" size={16} strokeWidth={2.5} />
      {move.kind === 'in' || move.kind === 'out' ? (
        // Entering or leaving the ranking: the words say it, then the place.
        <>
          <span className="sr-only">
            {t(move.kind === 'in' ? 'admin.recompute.in' : 'admin.recompute.out')}{' '}
          </span>
          <span aria-hidden="true">{before}</span>
          <ArrowRight aria-hidden="true" size={16} strokeWidth={2.5} />
          {after}
        </>
      ) : (
        <>
          <span className="sr-only">{t(up ? 'admin.recompute.up' : 'admin.recompute.down')} </span>
          {before}
          <ArrowRight aria-hidden="true" size={16} strokeWidth={2.5} />
          <span className="sr-only"> {t('admin.recompute.to')} </span>
          {after}
        </>
      )}
    </span>
  );
}

/** The value shown for a line: none out of the ranking (no value is shown there). */
function shownValue(entry: LeaderboardEntry | null): number | null {
  return entry && !isOut(entry) ? entry.value : null;
}

/** Whether the value shown changes. */
function valueChanges(change: LineChange<LeaderboardEntry>): boolean {
  return change.move !== null && shownValue(change.before) !== shownValue(change.after);
}

/** A value of the ranking, or a dash for a participant without one. */
function ValueCell({
  entry,
  type,
  referenceSport,
}: {
  entry: LeaderboardEntry | null;
  type: CategoryType;
  referenceSport: string | undefined;
}) {
  const value = useEntryValue(type, shownValue(entry), referenceSport);
  return <>{value || '—'}</>;
}

/** Whether a line is shown: its place or its value changes (all, without a comparison). */
function isShown(change: LineChange<LeaderboardEntry>): boolean {
  if (!change.move) return true;
  return change.move.kind !== 'same' || valueChanges(change);
}

/**
 * One category, before and after the change: the participants whose rank
 * or value changes, those whose value changes highlighted. Without one of
 * the two rankings (a deleted challenge has none), every participant of the
 * other.
 */
function CategoryPreview({
  type,
  before,
  after,
  showBefore,
  showAfter,
  referenceSport,
}: {
  type: CategoryType;
  before: CategoryRanking | null;
  after: CategoryRanking | null;
  showBefore: boolean;
  showAfter: boolean;
  referenceSport: string;
}) {
  const { t } = useTranslation();
  const headingId = useId();
  const categoryName = useCategoryName(referenceSport)(type);
  const name = useName();
  const all = rankingChanges(
    showBefore ? (before?.entries ?? []) : null,
    showAfter ? (after?.entries ?? []) : null,
  );
  const shown = all.filter(isShown);
  const tiesBefore = tiesOf(before);
  const tiesAfter = tiesOf(after);
  return (
    // Not a named region: its table is one already, under the same name.
    <div className="flex min-w-0 flex-col gap-2 rounded-card border border-border bg-surface pt-4 pb-4">
      <h4 id={headingId} className="px-4 text-sm font-bold tracking-wide uppercase md:px-6">
        {categoryName}
      </h4>
      {shown.length === 0 ? (
        <p className="px-4 text-sm text-muted md:px-6">{t('admin.recompute.nothing')}</p>
      ) : (
        <div
          role="region"
          aria-labelledby={headingId}
          tabIndex={0}
          className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <table className="w-full min-w-104 text-sm">
            <thead>
              <tr className="text-xs tracking-wide text-muted uppercase">
                <th scope="col" className="py-3 pr-4 pl-4 text-left font-semibold md:pl-6">
                  {t('admin.recompute.participant')}
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  {t('admin.recompute.rank')}
                </th>
                {showBefore && (
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    {t('admin.recompute.before')}
                  </th>
                )}
                {showAfter && (
                  <th scope="col" className="py-3 pr-4 pl-4 text-right font-semibold md:pr-6">
                    {t('admin.recompute.after')}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {shown.map((change) => {
                const user = (change.after ?? change.before)?.user;
                const valueChanged = valueChanges(change);
                return (
                  <tr key={change.userId} className={valueChanged ? 'bg-accent-soft' : undefined}>
                    <th scope="row" className={`${CELL} font-semibold md:pl-6`}>
                      {user ? name(user) : t('admin.challenges.unnamed')}
                    </th>
                    <td className={`${CELL} whitespace-nowrap`}>
                      <RankCell change={change} tiesBefore={tiesBefore} tiesAfter={tiesAfter} />
                    </td>
                    {showBefore && (
                      <td className={`${CELL} text-right whitespace-nowrap tabular-nums`}>
                        <ValueCell
                          entry={change.before}
                          type={type}
                          referenceSport={referenceSport}
                        />
                      </td>
                    )}
                    {showAfter && (
                      <td
                        className={`${CELL} text-right whitespace-nowrap tabular-nums md:pr-6 ${valueChanged ? 'font-bold' : ''}`}
                      >
                        <ValueCell
                          entry={change.after}
                          type={type}
                          referenceSport={referenceSport}
                        />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {shown.length > 0 && shown.length < all.length && (
        <p className="px-4 text-sm text-muted md:px-6">{t('admin.recompute.others')}</p>
      )}
    </div>
  );
}

/**
 * An elimination the change gives, removes or moves, in a sentence: green
 * when it is removed, red when it is given, plain when it moves. The words
 * say which; the colour only repeats it.
 */
function EliminationNote({ change }: { change: AdminEliminationChange }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const name = useName()(change.user);
  const km = (meters: number) => formatKm(meters / 1000, locale);
  const { before, after } = change;
  const judged = after ?? before;
  if (!judged) return null;
  const figures = (judgement: typeof judged) => ({
    done: km(judgement.distance_meters),
    required: km(judgement.required_meters),
  });
  let sentence: string;
  let detail: string;
  if (after === null) {
    sentence = t('admin.recompute.elimination.removed', { name, week: judged.week_number });
    detail = t('admin.recompute.elimination.was', figures(judged));
  } else if (before === null) {
    sentence = t('admin.recompute.elimination.given', { name, week: after.week_number });
    detail = t('admin.recompute.elimination.done', figures(after));
  } else if (before.week_number !== after.week_number) {
    sentence = t('admin.recompute.elimination.moved', {
      name,
      week: after.week_number,
      was: before.week_number,
    });
    detail = t('admin.recompute.elimination.done', figures(after));
  } else {
    // Same week, other distance or minimum: both, before and after.
    sentence = t('admin.recompute.elimination.kept', { name, week: after.week_number });
    detail = t('admin.recompute.elimination.changed', {
      before: t('admin.recompute.elimination.done', figures(before)),
      after: t('admin.recompute.elimination.done', figures(after)),
    });
  }
  const tone =
    after === null
      ? 'bg-ok-bg text-ok-fg'
      : before === null
        ? 'bg-risk-bg text-risk-fg'
        : 'border border-border bg-surface text-ink';
  return (
    <li className={`flex gap-3 rounded-card p-4 md:px-6 ${tone}`}>
      <Flag aria-hidden="true" size={20} className="mt-0.5 flex-none" />
      <p>
        <span className="font-bold">{sentence}</span> {detail}
      </p>
    </li>
  );
}

/**
 * One challenge the change touches, in a card: its title and status (from
 * its admin sheet, read first: loading, then an error with retry), each
 * category, and the eliminations that change.
 */
function ChallengePreview({ preview }: { preview: AdminChallengePreview }) {
  const { t } = useTranslation();
  const headingId = useId();
  const challenge = useAdminChallenge(preview.challenge_id);
  // Its title and reference sport name the rankings: read before them.
  if (challenge.isPending) return <LoadingState />;
  if (challenge.isError) {
    return <ErrorState error={challenge.error} onRetry={() => void challenge.refetch()} />;
  }
  const { title, status, reference_sport: referenceSport } = challenge.data;
  const showBefore = preview.before !== null;
  const showAfter = preview.after !== null;
  const categories = categoryChanges(
    preview.before?.categories ?? null,
    preview.after?.categories ?? null,
  );
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4 md:p-6"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 id={headingId} className="font-display text-xl font-bold">
          {title}
        </h3>
        {status && <p className="text-sm text-muted">{t(`admin.challenges.status.${status}`)}</p>}
      </div>
      {!showBefore && <p className="text-sm text-muted">{t('admin.recompute.noBefore')}</p>}
      {!showAfter && <p className="text-sm text-muted">{t('admin.recompute.noAfter')}</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {categories.map((category) => (
          <CategoryPreview
            key={category.type}
            type={category.type}
            before={category.before}
            after={category.after}
            showBefore={showBefore}
            showAfter={showAfter}
            referenceSport={referenceSport}
          />
        ))}
      </div>
      {preview.eliminations.length > 0 && (
        <ul className="grid gap-4 lg:grid-cols-2">
          {preview.eliminations.map((change) => (
            <EliminationNote key={change.user.id} change={change} />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * What an admin change would do (README §2.12, « Recalcul et aperçu »): for
 * each challenge it touches, the participants whose rank or value changes
 * in each category (by arrows and words), and the eliminations that change.
 * Ranks, ties and who is out are the server's, shown as on the leaderboard.
 */
export function RecomputePreview({ correction }: { correction: AdminCorrection }) {
  const { t } = useTranslation();
  if (correction.challenges.length === 0) {
    return <EmptyState message={t('admin.recompute.none')} />;
  }
  return (
    <div className="flex flex-col gap-6">
      {correction.challenges.map((preview) => (
        <ChallengePreview key={preview.challenge_id} preview={preview} />
      ))}
    </div>
  );
}
