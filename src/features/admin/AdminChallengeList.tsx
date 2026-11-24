import { Search } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import {
  useAdminChallenges,
  type AdminChallengeSummary,
  type AdminUserRef,
} from '../../api/hooks/admin/useAdminChallenges';
import { useFetchAllPages } from '../../api/hooks/useFetchAllPages';
import { LoadMore } from '../../components/LoadMore';
import { PageSizeChoice } from '../../components/PageSizeChoice';
import { EmptyState } from '../../components/states/EmptyState';
import { ErrorState } from '../../components/states/ErrorState';
import { LoadingState } from '../../components/states/LoadingState';
import {
  CHALLENGE_VISIBILITIES,
  MAX_SEARCH_LENGTH,
  readAdminChallengeFilters,
} from '../../domain/adminChallenges';
import { CHALLENGE_STATUSES } from '../../domain/challenge';
import { displayName } from '../../domain/displayName';
import { challengePeriod } from '../../domain/format/challengeDates';
import { usePageSize } from '../../lib/pageSize';
import { AdminTable } from './AdminTable';
import { CELL } from './adminCells';

const CHIP = 'flex h-11 shrink-0 items-center rounded-full border px-4 text-sm font-bold';
const CHIP_ON = 'border-accent bg-accent-soft text-accent';
const CHIP_OFF = 'border-border bg-surface text-muted hover-border';

/** A row of filter chips, one of them chosen (`aria-pressed`). */
function Chips<T extends string>({
  label,
  options,
  selected,
  onSelect,
  name,
}: {
  label: string;
  options: readonly (T | undefined)[];
  selected: T | undefined;
  onSelect: (value: T | undefined) => void;
  name: (value: T | undefined) => string;
}) {
  return (
    // The padding keeps the focus ring whole inside the scrolling row.
    <div
      role="group"
      aria-label={label}
      className="-mx-5 flex min-w-0 gap-2 overflow-x-auto px-5 py-1 md:mx-0 md:px-0.5"
    >
      {options.map((value) => (
        <button
          key={value ?? 'all'}
          type="button"
          aria-pressed={selected === value}
          onClick={() => onSelect(value)}
          className={`${CHIP} ${selected === value ? CHIP_ON : CHIP_OFF}`}
        >
          {name(value)}
        </button>
      ))}
    </div>
  );
}

/** "ami_1, Marie Tremblay": the creators, a deleted account unnamed. */
function useCreatorNames() {
  const { t } = useTranslation();
  return (creators: AdminUserRef[]) =>
    creators.map((user) => displayName(user) ?? t('admin.challenges.unnamed')).join(', ');
}

/**
 * Every challenge for the admin, private and deleted ones included, newest
 * first: a search on the title, chips for the status, the visibility and the
 * deleted ones, then a table page by page (10, 50 or all, kept on the
 * device). The filters live in the address, so going back keeps them.
 */
export function AdminChallengeList() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const [params, setParams] = useSearchParams();
  const filters = readAdminChallengeFilters(params);
  const [size, setSize] = usePageSize('adminChallenges');
  const challenges = useAdminChallenges(filters, size);
  useFetchAllPages(challenges, size === 'all');
  const creatorNames = useCreatorNames();
  const items = challenges.data?.pages.flatMap((page) => page.items) ?? [];
  const filtered = Object.keys(filters).length > 0;

  const choose = (name: string, value: string | undefined) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    setParams(next, { replace: true });
  };
  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const q = new FormData(event.currentTarget).get('q');
    choose('q', typeof q === 'string' ? q.trim() : undefined);
  };

  let body: ReactNode;
  if (challenges.isPending) body = <LoadingState />;
  else if (!challenges.data) {
    body = <ErrorState error={challenges.error} onRetry={() => void challenges.refetch()} />;
  } else if (items.length === 0) {
    body = (
      <EmptyState
        message={t(filtered ? 'admin.challenges.empty.filtered' : 'admin.challenges.empty.none')}
        action={
          filtered && (
            <button
              type="button"
              onClick={() => setParams(new URLSearchParams(), { replace: true })}
              className="h-11 rounded-full border border-border bg-surface hover-fill px-5 font-bold"
            >
              {t('admin.challenges.clearFilters')}
            </button>
          )
        }
      />
    );
  } else {
    body = (
      <>
        <AdminTable
          caption={t('admin.challenges.listLabel')}
          columns={[
            t('admin.challenges.columns.title'),
            t('admin.challenges.columns.creators'),
            t('admin.challenges.columns.participants'),
            t('admin.challenges.columns.period'),
            t('admin.challenges.columns.status'),
          ]}
        >
          {items.map((challenge) => (
            <ChallengeRow
              key={challenge.id}
              challenge={challenge}
              creators={creatorNames(challenge.creators)}
              locale={locale}
            />
          ))}
        </AdminTable>
        <LoadMore
          hasMore={challenges.hasNextPage}
          loading={challenges.isFetchingNextPage}
          failed={challenges.isFetchNextPageError}
          auto={size === 'all'}
          onLoadMore={() => void challenges.fetchNextPage()}
        />
      </>
    );
  }

  return (
    // Not a named region: its table is one, under the same name.
    <section className="mt-6 flex flex-col gap-4">
      <form role="search" onSubmit={search} className="flex gap-2">
        <label htmlFor="admin-challenge-search" className="sr-only">
          {t('admin.challenges.search.label')}
        </label>
        <input
          // A new address (going back) puts its search back in the field.
          key={filters.q ?? ''}
          id="admin-challenge-search"
          name="q"
          type="search"
          defaultValue={filters.q}
          maxLength={MAX_SEARCH_LENGTH}
          placeholder={t('admin.challenges.search.placeholder')}
          className="h-11 min-w-0 flex-1 rounded-row border border-border bg-surface px-4"
        />
        <button
          type="submit"
          className="flex h-11 items-center gap-2 rounded-full bg-accent hover-accent px-5 font-bold text-on-accent"
        >
          <Search aria-hidden="true" size={18} />
          {t('admin.challenges.search.submit')}
        </button>
      </form>
      <Chips
        label={t('challenges.status.label')}
        options={[undefined, ...CHALLENGE_STATUSES]}
        selected={filters.status}
        onSelect={(value) => choose('status', value)}
        name={(value) => t(`challenges.status.${value ?? 'all'}`)}
      />
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <Chips
          label={t('admin.challenges.visibility.label')}
          options={[undefined, ...CHALLENGE_VISIBILITIES]}
          selected={filters.visibility}
          onSelect={(value) => choose('visibility', value)}
          name={(value) => t(`admin.challenges.visibility.${value ?? 'all'}`)}
        />
        <button
          type="button"
          aria-pressed={filters.deleted === true}
          onClick={() => choose('deleted', filters.deleted ? undefined : 'true')}
          className={`${CHIP} self-start md:self-auto ${filters.deleted ? CHIP_ON : CHIP_OFF}`}
        >
          {t('admin.challenges.deleted')}
        </button>
      </div>
      <PageSizeChoice size={size} onChange={setSize} />
      <div>{body}</div>
    </section>
  );
}

function ChallengeRow({
  challenge,
  creators,
  locale,
}: {
  challenge: AdminChallengeSummary;
  creators: string;
  locale: string;
}) {
  const { t } = useTranslation();
  const period = challengePeriod(
    challenge.starts_at,
    challenge.ends_at,
    challenge.timezone,
    locale,
    true,
  );
  const marks = [
    challenge.visibility === 'private' && t('admin.challenges.visibility.privateOne'),
    challenge.deleted_at !== null && t('admin.challenges.deletedOne'),
  ].filter(Boolean);
  return (
    <tr>
      <th scope="row" className={`${CELL} font-semibold`}>
        <Link
          to={`/admin/challenges/${challenge.id}`}
          className="inline-flex min-h-11 items-center text-accent underline underline-offset-4 hover-link"
        >
          {challenge.title}
        </Link>
        {marks.length > 0 && (
          <span className="block text-xs font-normal text-muted">{marks.join(' · ')}</span>
        )}
      </th>
      <td className={CELL}>{creators}</td>
      <td className={`${CELL} tabular-nums`}>
        {new Intl.NumberFormat(locale).format(challenge.participant_count)}
      </td>
      <td className={`${CELL} whitespace-nowrap`}>{t('admin.challenges.period', period)}</td>
      <td className={CELL}>{t(`admin.challenges.status.${challenge.status}`)}</td>
    </tr>
  );
}
