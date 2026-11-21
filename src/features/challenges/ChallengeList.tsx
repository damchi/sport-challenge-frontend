import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { useChallenges } from '../../api/hooks/useChallenges';
import { LoadMore } from '../../components/LoadMore';
import { EmptyState } from '../../components/states/EmptyState';
import { ErrorState } from '../../components/states/ErrorState';
import { LoadingState } from '../../components/states/LoadingState';
import {
  CHALLENGE_SCOPES,
  CHALLENGE_STATUSES,
  isChallengeScope,
  isChallengeStatus,
} from '../../domain/challenge';
import { ChallengeCard } from './ChallengeCard';

const SEGMENT = 'h-11 flex-1 rounded-tab text-sm font-semibold';
const SEGMENT_ON = 'bg-segment-active text-ink shadow-[0_1px_3px_rgba(22,24,29,.12)]';
const SEGMENT_OFF = 'text-muted';

const CHIP = 'h-11 shrink-0 rounded-full border px-4 text-sm font-semibold';
const CHIP_ON = 'border-accent bg-accent-soft text-accent';
const CHIP_OFF = 'border-border bg-surface text-muted';

/**
 * Challenges of the home page: public ones or mine (tabs), filtered by the
 * status the server computes, page by page. The choices live in the address
 * (?scope=&status=), so going back keeps them. A tile to create a challenge
 * ends the list.
 */
export function ChallengeList() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const scopeParam = params.get('scope');
  const statusParam = params.get('status');
  const scope = isChallengeScope(scopeParam) ? scopeParam : 'public';
  const status = isChallengeStatus(statusParam) ? statusParam : undefined;
  const challenges = useChallenges(scope, status);

  const choose = (name: 'scope' | 'status', value: string | undefined) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    setParams(next, { replace: true });
  };

  const items = challenges.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <section className="mt-6" aria-label={t('challenges.listLabel')}>
      <div className="flex rounded-row bg-segment p-1 md:max-w-sm">
        {CHALLENGE_SCOPES.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={scope === value}
            onClick={() => choose('scope', value === 'public' ? undefined : value)}
            className={`${SEGMENT} ${scope === value ? SEGMENT_ON : SEGMENT_OFF}`}
          >
            {t(`challenges.scope.${value}`)}
          </button>
        ))}
      </div>

      <div
        role="group"
        aria-label={t('challenges.status.label')}
        className="mt-4 flex gap-2 overflow-x-auto px-0.5 py-1"
      >
        {[undefined, ...CHALLENGE_STATUSES].map((value) => (
          <button
            key={value ?? 'all'}
            type="button"
            aria-pressed={status === value}
            onClick={() => choose('status', value)}
            className={`${CHIP} ${status === value ? CHIP_ON : CHIP_OFF}`}
          >
            {t(`challenges.status.${value ?? 'all'}`)}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {challenges.isPending ? (
          <LoadingState />
        ) : !challenges.data ? (
          // Nothing loaded: the whole list failed (a failed "load more" keeps it).
          <ErrorState error={challenges.error} onRetry={() => void challenges.refetch()} />
        ) : items.length === 0 ? (
          status ? (
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
          ) : (
            <EmptyState
              message={t(`challenges.empty.${scope}`)}
              action={
                <Link
                  to="/challenges/new"
                  className="inline-flex h-13 items-center rounded-full bg-accent px-6 text-button font-bold text-on-accent"
                >
                  {t('challenges.create')}
                </Link>
              }
            />
          )
        ) : (
          <>
            <ul className="grid grid-cols-1 gap-3 lg:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] lg:gap-4">
              {items.map((challenge) => (
                <li key={challenge.id}>
                  <ChallengeCard challenge={challenge} showStatus={!status} />
                </li>
              ))}
              {/* Creating stays at hand once the list is not empty. */}
              <li>
                <Link
                  to="/challenges/new"
                  className="flex h-full min-h-30 items-center justify-center gap-2 rounded-card border-2 border-dashed border-border-dashed p-4 font-bold text-accent"
                >
                  <Plus aria-hidden="true" size={22} strokeWidth={2} />
                  {t('challenges.create')}
                </Link>
              </li>
            </ul>
            <LoadMore
              hasMore={challenges.hasNextPage}
              loading={challenges.isFetchingNextPage}
              failed={challenges.isFetchNextPageError}
              onLoadMore={() => void challenges.fetchNextPage()}
            />
          </>
        )}
      </div>
    </section>
  );
}
