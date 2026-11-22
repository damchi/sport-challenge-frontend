import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { useChallenges } from '../../api/hooks/useChallenges';
import { LoadMore } from '../../components/LoadMore';
import { EmptyState } from '../../components/states/EmptyState';
import { ErrorState } from '../../components/states/ErrorState';
import { LoadingState } from '../../components/states/LoadingState';
import {
  CHALLENGE_SCOPES,
  isChallengeScope,
  isChallengeStatus,
  type ChallengeScope,
  type ChallengeStatus,
} from '../../domain/challenge';
import { ChallengeCard } from './ChallengeCard';

const SEGMENT = 'h-11 flex-1 rounded-tab text-sm font-semibold';
const SEGMENT_ON = 'bg-segment-active text-ink shadow-[0_1px_3px_rgba(22,24,29,.12)]';
const SEGMENT_OFF = 'text-muted';

const CHIP =
  'flex h-11 shrink-0 items-center gap-2 rounded-full border pr-2 pl-4 text-sm font-bold';
const CHIP_ON = 'border-accent bg-accent-soft text-accent';
const CHIP_OFF = 'border-border bg-surface text-muted';
const COUNT = 'min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs tabular-nums';
const COUNT_ON = 'bg-accent text-on-accent';
const COUNT_OFF = 'bg-segment text-ink';

/** The sections of « Tous », in the mockup's order. */
const SECTIONS: readonly ChallengeStatus[] = ['ongoing', 'upcoming', 'finished'];

/**
 * Challenges of the home page: mine (the default) or the public ones (tabs),
 * filtered by the status the server computes, each status with its count
 * (the server's, whatever the filter). Without a filter, one section per
 * status, each read page by page on its own. The choices live in the
 * address (?scope=&status=), so going back keeps them.
 */
export function ChallengeList() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const scopeParam = params.get('scope');
  const statusParam = params.get('status');
  const scope = isChallengeScope(scopeParam) ? scopeParam : 'mine';
  const status = isChallengeStatus(statusParam) ? statusParam : undefined;
  // Every page gives the counts of the scope: the first section's (or the
  // filter's) query, shared with that section.
  const counted = useChallenges(scope, status ?? SECTIONS[0]);
  const counts = counted.data?.pages[0]?.counts;
  const total = counts ? counts.upcoming + counts.ongoing + counts.finished : undefined;

  const choose = (name: 'scope' | 'status', value: string | undefined) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    setParams(next, { replace: true });
  };

  let body: ReactNode;
  if (status) {
    body = (
      <ChallengeSection
        scope={scope}
        status={status}
        empty={
          <EmptyState
            message={t('challenges.empty.filtered')}
            action={
              <button
                type="button"
                onClick={() => choose('status', undefined)}
                className="h-11 rounded-full border border-border bg-surface px-5 font-bold"
              >
                {t('challenges.showAll')}
              </button>
            }
          />
        }
      />
    );
  } else if (counted.isPending) {
    body = <LoadingState />;
  } else if (!counts) {
    body = <ErrorState error={counted.error} onRetry={() => void counted.refetch()} />;
  } else if (total === 0) {
    // « Créer un défi » is the page's own button (beside the title, floating on a phone).
    body = <EmptyState message={t(`challenges.empty.${scope}`)} />;
  } else {
    body = SECTIONS.filter((section) => counts[section] > 0).map((section) => (
      <ChallengeSection key={section} scope={scope} status={section} />
    ));
  }

  return (
    <section className="mt-6" aria-label={t('challenges.listLabel')}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex rounded-row bg-segment p-1 md:w-80">
          {CHALLENGE_SCOPES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={scope === value}
              onClick={() => choose('scope', value === 'mine' ? undefined : value)}
              className={`${SEGMENT} ${scope === value ? SEGMENT_ON : SEGMENT_OFF}`}
            >
              {t(`challenges.scope.${value}`)}
            </button>
          ))}
        </div>

        {/* The padding keeps the focus ring whole inside the scrolling row; relative
            keeps the hidden words of the counts inside it too. */}
        <div
          role="group"
          aria-label={t('challenges.status.label')}
          className="relative -mx-5 flex min-w-0 gap-2 overflow-x-auto px-5 py-1 md:mx-0 md:px-0.5"
        >
          {[undefined, ...SECTIONS].map((value) => {
            const on = status === value;
            const count = counts && (value ? counts[value] : total);
            return (
              <button
                key={value ?? 'all'}
                type="button"
                aria-pressed={on}
                onClick={() => choose('status', value)}
                className={`${CHIP} ${on ? CHIP_ON : CHIP_OFF}`}
              >
                {t(`challenges.status.${value ?? 'all'}`)}
                {count !== undefined && ' '}
                {count !== undefined && (
                  <span className={`${COUNT} ${on ? COUNT_ON : COUNT_OFF}`}>
                    {count}
                    {/* Read as "En cours 2 défis", the visible text first. */}
                    <span className="sr-only"> {t('challenges.status.unit', { count })}</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Room for the floating button of a phone below the last card. */}
      <div className="pb-20 md:pb-0">{body}</div>
    </section>
  );
}

/**
 * The challenges of one status, under its heading, page by page: its own
 * loading, error (with a retry) and "load more".
 */
function ChallengeSection({
  scope,
  status,
  empty,
}: {
  scope: ChallengeScope;
  status: ChallengeStatus;
  empty?: ReactNode;
}) {
  const { t } = useTranslation();
  const challenges = useChallenges(scope, status);
  const items = challenges.data?.pages.flatMap((page) => page.items) ?? [];
  const id = `challenges-${status}`;

  let content: ReactNode;
  if (challenges.isPending) content = <LoadingState />;
  else if (!challenges.data) {
    // Nothing loaded: the whole section failed (a failed "load more" keeps it).
    content = <ErrorState error={challenges.error} onRetry={() => void challenges.refetch()} />;
  } else if (items.length === 0) {
    // A section of « Tous » left empty since it was counted: not shown at all.
    if (!empty) return null;
    content = empty;
  } else {
    content = (
      <>
        <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[repeat(auto-fill,minmax(18rem,21.25rem))] md:gap-4">
          {items.map((challenge) => (
            <li key={challenge.id}>
              <ChallengeCard challenge={challenge} />
            </li>
          ))}
        </ul>
        <LoadMore
          hasMore={challenges.hasNextPage}
          loading={challenges.isFetchingNextPage}
          failed={challenges.isFetchNextPageError}
          onLoadMore={() => void challenges.fetchNextPage()}
        />
      </>
    );
  }

  return (
    <section aria-labelledby={id} className="mt-6">
      <h2 id={id} className="font-display text-xl font-bold">
        {t(`challenges.status.${status}`)}
      </h2>
      {content}
    </section>
  );
}
