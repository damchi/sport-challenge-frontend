import { Search } from 'lucide-react';
import { useMemo, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAdminUsers, type AdminUser } from '../../api/hooks/admin/useAdminUsers';
import { useFetchAllPages } from '../../api/hooks/useFetchAllPages';
import { LoadMore } from '../../components/LoadMore';
import { PageSizeChoice } from '../../components/PageSizeChoice';
import { EmptyState } from '../../components/states/EmptyState';
import { ErrorState } from '../../components/states/ErrorState';
import { LoadingState } from '../../components/states/LoadingState';
import { MAX_USER_SEARCH_LENGTH, readUserSearch } from '../../domain/adminUsers';
import { displayName } from '../../domain/displayName';
import { usePageSize } from '../../lib/pageSize';
import { AccountStatePill } from './AccountStatePill';
import { AdminTable } from './AdminTable';
import { CELL } from './adminCells';

interface Formats {
  /** "24 nov. 2026" in the device's zone: an account belongs to no challenge. */
  day: (instant: string) => string;
  count: (value: number) => string;
}

/**
 * Every account for the admin, deleted ones included, most recently
 * registered first: a search on the pseudo, the names and the e-mail, then a
 * table page by page (10, 50 or all, kept on the device). The search may be
 * an e-mail: it is kept in the history entry (going back finds it), never in
 * the address, and sent in the body of a POST.
 */
export function AdminUserList() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const location = useLocation();
  const navigate = useNavigate();
  const q = readUserSearch(location.state);
  const [size, setSize] = usePageSize('adminUsers');
  const users = useAdminUsers(q, size);
  useFetchAllPages(users, size === 'all');
  const items = users.data?.pages.flatMap((page) => page.items) ?? [];
  // Made once for every row: "all" may list many accounts.
  const formats = useMemo<Formats>(() => {
    const day = new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    const count = new Intl.NumberFormat(locale);
    return {
      day: (instant) => day.format(new Date(instant)),
      count: (value) => count.format(value),
    };
  }, [locale]);

  const searchFor = (next: string | undefined) =>
    void navigate(location.pathname, { replace: true, state: next ? { q: next } : null });
  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('q');
    searchFor(typeof value === 'string' ? value.trim() : undefined);
  };

  let body: ReactNode;
  if (users.isPending) body = <LoadingState />;
  else if (!users.data) {
    body = <ErrorState error={users.error} onRetry={() => void users.refetch()} />;
  } else if (items.length === 0) {
    body = (
      <EmptyState
        message={t(q ? 'admin.users.empty.search' : 'admin.users.empty.none')}
        action={
          q && (
            <button
              type="button"
              onClick={() => searchFor(undefined)}
              className="h-11 rounded-full border border-border bg-surface hover-fill px-5 font-bold"
            >
              {t('admin.users.clearSearch')}
            </button>
          )
        }
      />
    );
  } else {
    body = (
      <>
        <AdminTable
          caption={t('admin.users.listLabel')}
          columns={[
            t('admin.users.columns.account'),
            t('admin.users.columns.state'),
            t('admin.users.columns.createdAt'),
            t('admin.users.columns.lastActivity'),
            t('admin.users.columns.challenges'),
          ]}
        >
          {items.map((user) => (
            <UserRow key={user.id} user={user} formats={formats} />
          ))}
        </AdminTable>
        <LoadMore
          hasMore={users.hasNextPage}
          loading={users.isFetchingNextPage}
          failed={users.isFetchNextPageError}
          auto={size === 'all'}
          onLoadMore={() => void users.fetchNextPage()}
        />
      </>
    );
  }

  return (
    // Not a named region: its table is one, under the same name.
    <section className="mt-6 flex flex-col gap-4">
      <form role="search" onSubmit={search} className="flex gap-2">
        <label htmlFor="admin-user-search" className="sr-only">
          {t('admin.users.search.label')}
        </label>
        <input
          // A new search (going back) puts its text back in the field.
          key={q ?? ''}
          id="admin-user-search"
          name="q"
          type="search"
          defaultValue={q}
          maxLength={MAX_USER_SEARCH_LENGTH}
          autoComplete="off"
          placeholder={t('admin.users.search.placeholder')}
          className="h-11 min-w-0 flex-1 rounded-row border border-border bg-surface px-4"
        />
        <button
          type="submit"
          className="flex h-11 items-center gap-2 rounded-full bg-accent hover-accent px-5 font-bold text-on-accent"
        >
          <Search aria-hidden="true" size={18} />
          {t('admin.users.search.submit')}
        </button>
      </form>
      <PageSizeChoice size={size} onChange={setSize} />
      <div>{body}</div>
    </section>
  );
}

function UserRow({ user, formats: { day, count } }: { user: AdminUser; formats: Formats }) {
  const { t } = useTranslation();
  const name = displayName(user);
  return (
    <tr>
      <th scope="row" className={`${CELL} font-semibold`}>
        <Link
          to={`/admin/users/${user.id}`}
          className="inline-flex min-h-11 items-center break-all text-accent underline underline-offset-4 hover-link"
        >
          {name ?? t(user.deleted_at === null ? 'admin.users.noName' : 'admin.users.unnamed')}
        </Link>
        {user.email && (
          <span className="block break-all text-xs font-normal text-muted">{user.email}</span>
        )}
      </th>
      <td className={CELL}>
        <AccountStatePill state={user.state} />
      </td>
      <td className={`${CELL} whitespace-nowrap`}>{day(user.created_at)}</td>
      <td className={`${CELL} whitespace-nowrap`}>
        {user.last_activity_at ? (
          day(user.last_activity_at)
        ) : (
          <span className="text-muted">{t('admin.users.never')}</span>
        )}
      </td>
      <td className={`${CELL} tabular-nums`}>{count(user.challenge_count)}</td>
    </tr>
  );
}
