import { useTranslation } from 'react-i18next';
import { useAdminChallenge } from '../../api/hooks/admin/useAdminChallenges';
import type {
  AdminChallengePreview,
  AdminCorrection,
  AdminEliminationChange,
} from '../../api/hooks/admin/useAdminCorrection';
import type { Leaderboard, LeaderboardEntry } from '../../api/hooks/useChallenges';
import { EmptyState } from '../../components/states/EmptyState';
import { displayName } from '../../domain/displayName';
import { formatKm } from '../../domain/format/distance';
import { sharedRanks } from '../../domain/format/rank';
import {
  categoryChanges,
  isOut,
  rankingChanges,
  type LineChange,
  type Move,
} from '../../domain/rankingChanges';
import { useCategoryName } from '../challenges/detail/categoryNames';
import { useEntryValue } from '../leaderboard/useEntryValue';
import { AdminTable } from './AdminTable';
import { CELL } from './adminCells';

type CategoryRanking = Leaderboard['categories'][number];
type CategoryType = CategoryRanking['type'];

/** Ranks shared by more than one ranked participant (ties: 1, 1, 3). */
function tiesOf(category: CategoryRanking | null): Set<number> {
  return sharedRanks(
    (category?.entries ?? []).filter((entry) => !isOut(entry)).map((entry) => entry.rank),
  );
}

/**
 * A participant's place on one side of the change: their rank (noted when
 * shared) and value, or why they are out of the ranking, as the leaderboard
 * says it.
 */
function Standing({
  entry,
  type,
  ties,
  referenceSport,
}: {
  entry: LeaderboardEntry | null;
  type: CategoryType;
  ties: Set<number>;
  referenceSport: string | undefined;
}) {
  const { t } = useTranslation();
  const value = useEntryValue(type, entry?.value ?? null, referenceSport);
  if (!entry) return <span className="text-muted">{t('admin.recompute.absent')}</span>;
  if (isOut(entry)) {
    const week = entry.elimination?.eliminated_week;
    return (
      <span className="text-muted">
        {entry.abandoned || !week
          ? t('leaderboard.abandoned')
          : t('leaderboard.eliminated', { week })}
      </span>
    );
  }
  const tied = entry.rank !== null && ties.has(entry.rank);
  return (
    <span className="flex flex-col">
      <span className="font-bold tabular-nums">
        {entry.rank}
        {tied && <span className="font-normal text-muted"> {t('leaderboard.tied')}</span>}
      </span>
      <span className="text-muted tabular-nums">{value}</span>
    </span>
  );
}

/** The move, by an arrow and a text: the colour is never the only signal. */
function MoveText({ move }: { move: Move }) {
  const { t } = useTranslation();
  switch (move.kind) {
    case 'up':
      return (
        <span className="font-semibold text-ok-fg">
          <span aria-hidden="true">↑ </span>
          {t('admin.recompute.move.up', { count: move.places })}
        </span>
      );
    case 'down':
      return (
        <span className="font-semibold text-risk-fg">
          <span aria-hidden="true">↓ </span>
          {t('admin.recompute.move.down', { count: move.places })}
        </span>
      );
    case 'in':
      return (
        <span className="font-semibold text-ok-fg">
          <span aria-hidden="true">↑ </span>
          {t('admin.recompute.move.in')}
        </span>
      );
    case 'out':
      return (
        <span className="font-semibold text-risk-fg">
          <span aria-hidden="true">↓ </span>
          {t('admin.recompute.move.out')}
        </span>
      );
    case 'same':
      return (
        <span className="text-muted">
          <span aria-hidden="true">= </span>
          {t('admin.recompute.move.same')}
        </span>
      );
  }
}

/** A name, or the words for an account that has none. */
function useName() {
  const { t } = useTranslation();
  return (user: Parameters<typeof displayName>[0]) =>
    displayName(user) ?? t('admin.challenges.unnamed');
}

/**
 * One category of a challenge, before and after the change: every
 * participant, in the order of the ranking after it. A side the change has
 * not (a deleted challenge has no ranking) gets no column.
 */
function CategoryPreview({
  type,
  before,
  after,
  showBefore,
  showAfter,
  title,
  referenceSport,
}: {
  type: CategoryType;
  before: CategoryRanking | null;
  after: CategoryRanking | null;
  showBefore: boolean;
  showAfter: boolean;
  title: string;
  referenceSport: string | undefined;
}) {
  const { t } = useTranslation();
  const categoryName = useCategoryName(referenceSport)(type);
  const name = useName();
  const changes: LineChange<LeaderboardEntry>[] = rankingChanges(
    showBefore ? (before?.entries ?? []) : null,
    showAfter ? (after?.entries ?? []) : null,
  );
  const tiesBefore = tiesOf(before);
  const tiesAfter = tiesOf(after);
  const compared = showBefore && showAfter;
  return (
    <section className="flex flex-col gap-2">
      <h4 className="font-semibold">{categoryName}</h4>
      {changes.length === 0 ? (
        <EmptyState message={t('admin.recompute.nobody')} />
      ) : (
        <AdminTable
          caption={t('admin.recompute.caption', { challenge: title, category: categoryName })}
          columns={[
            t('admin.recompute.participant'),
            ...(showBefore ? [t('admin.recompute.before')] : []),
            ...(showAfter ? [t('admin.recompute.after')] : []),
            ...(compared ? [t('admin.recompute.change')] : []),
          ]}
        >
          {changes.map((change) => {
            const user = (change.after ?? change.before)?.user;
            return (
              <tr key={change.userId}>
                <th scope="row" className={`${CELL} font-semibold`}>
                  {user ? name(user) : t('admin.challenges.unnamed')}
                </th>
                {showBefore && (
                  <td className={CELL}>
                    <Standing
                      entry={change.before}
                      type={type}
                      ties={tiesBefore}
                      referenceSport={referenceSport}
                    />
                  </td>
                )}
                {showAfter && (
                  <td className={CELL}>
                    <Standing
                      entry={change.after}
                      type={type}
                      ties={tiesAfter}
                      referenceSport={referenceSport}
                    />
                  </td>
                )}
                {compared && change.move && (
                  <td className={CELL}>
                    <MoveText move={change.move} />
                  </td>
                )}
              </tr>
            );
          })}
        </AdminTable>
      )}
    </section>
  );
}

/** An elimination on one side of the change: its week and distance, or none. */
function EliminationText({
  judgement,
  locale,
}: {
  judgement: AdminEliminationChange['before'];
  locale: string;
}) {
  const { t } = useTranslation();
  if (!judgement) return <span className="text-muted">{t('admin.recompute.notEliminated')}</span>;
  const km = (meters: number) => formatKm(meters / 1000, locale);
  return (
    <span className="flex flex-col">
      <span className="font-semibold">
        {t('admin.challenges.weeks.number', { number: judgement.week_number })}
      </span>
      <span className="text-muted tabular-nums">
        {t('admin.challenges.eliminations.done', {
          done: km(judgement.distance_meters),
          required: km(judgement.required_meters),
        })}
      </span>
    </span>
  );
}

/** The eliminations the change gives, removes or moves. */
function EliminationsPreview({
  eliminations,
  title,
}: {
  eliminations: AdminEliminationChange[];
  title: string;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const name = useName();
  return (
    <section className="flex flex-col gap-2">
      <h4 className="font-semibold">{t('admin.recompute.eliminations')}</h4>
      {eliminations.length === 0 ? (
        <EmptyState message={t('admin.recompute.noElimination')} />
      ) : (
        <AdminTable
          caption={t('admin.recompute.caption', {
            challenge: title,
            category: t('admin.recompute.eliminations'),
          })}
          columns={[
            t('admin.recompute.participant'),
            t('admin.recompute.before'),
            t('admin.recompute.after'),
          ]}
        >
          {eliminations.map((change) => (
            <tr key={change.user.id}>
              <th scope="row" className={`${CELL} font-semibold`}>
                {name(change.user)}
              </th>
              <td className={CELL}>
                <EliminationText judgement={change.before} locale={locale} />
              </td>
              <td className={CELL}>
                <EliminationText judgement={change.after} locale={locale} />
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
    </section>
  );
}

/**
 * One challenge the change touches. Its title and reference sport come from
 * its admin sheet; until then (or if it cannot be read), a neutral title.
 */
function ChallengePreview({ preview }: { preview: AdminChallengePreview }) {
  const { t } = useTranslation();
  const challenge = useAdminChallenge(preview.challenge_id);
  const title = challenge.data?.title ?? t('admin.recompute.challenge');
  const referenceSport = challenge.data?.reference_sport;
  const showBefore = preview.before !== null;
  const showAfter = preview.after !== null;
  const categories = categoryChanges(
    preview.before?.categories ?? null,
    preview.after?.categories ?? null,
  );
  const hasElimination = categories.some((category) => category.type === 'elimination');
  return (
    <section className="flex flex-col gap-4">
      <h3 className="font-display text-lg font-bold">{title}</h3>
      {!showBefore && <p className="text-sm text-muted">{t('admin.recompute.noBefore')}</p>}
      {!showAfter && <p className="text-sm text-muted">{t('admin.recompute.noAfter')}</p>}
      {categories.map((category) => (
        <CategoryPreview
          key={category.type}
          type={category.type}
          before={category.before}
          after={category.after}
          showBefore={showBefore}
          showAfter={showAfter}
          title={title}
          referenceSport={referenceSport}
        />
      ))}
      {(hasElimination || preview.eliminations.length > 0) && (
        <EliminationsPreview eliminations={preview.eliminations} title={title} />
      )}
    </section>
  );
}

/**
 * What an admin change would do (README §2.12, « Recalcul et aperçu »): for
 * each challenge it touches, every ranking before and after it, the moves
 * (by an arrow and a text), and the eliminations that change. Ranks, ties
 * and who is out are the server's, shown as on the leaderboard.
 */
export function RecomputePreview({ correction }: { correction: AdminCorrection }) {
  const { t } = useTranslation();
  if (correction.challenges.length === 0) {
    return <EmptyState message={t('admin.recompute.none')} />;
  }
  return (
    <div className="flex flex-col gap-8">
      {correction.challenges.map((preview) => (
        <ChallengePreview key={preview.challenge_id} preview={preview} />
      ))}
    </div>
  );
}
