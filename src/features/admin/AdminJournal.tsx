import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { useAdminActions, type AdminAction } from '../../api/hooks/admin/useAdminActions';
import { useFetchAllPages } from '../../api/hooks/useFetchAllPages';
import { LoadMore } from '../../components/LoadMore';
import { PageSizeChoice } from '../../components/PageSizeChoice';
import { EmptyState } from '../../components/states/EmptyState';
import { ErrorState } from '../../components/states/ErrorState';
import { LoadingState } from '../../components/states/LoadingState';
import {
  ADMIN_ACTION_TARGET_TYPES,
  adminTargetPath,
  changedFields,
  journalValue,
  readAdminActionFilters,
} from '../../domain/adminActions';
import { displayName } from '../../domain/displayName';
import { usePageSize } from '../../lib/pageSize';
import { AdminTable } from './AdminTable';
import { Chips } from './Chips';
import { CELL } from './adminCells';

// One per line in the target cell, each 44 px high.
const LINK = 'flex min-h-11 items-center text-accent underline underline-offset-4 hover-link';
const BUTTON = 'h-11 rounded-full border border-border bg-surface hover-fill px-5 font-bold';

/**
 * The journal of the admin changes, most recent first: when, who, what, on
 * which target (its sheet, or its own journal), why, and the old and new
 * values on demand. Chips keep one kind of target; an address may keep one
 * target or one challenge (a sheet links to it). Page by page (10, 50 or
 * all, kept on the device). The filters live in the address.
 */
export function AdminJournal() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const [params, setParams] = useSearchParams();
  const filters = readAdminActionFilters(params);
  const [size, setSize] = usePageSize('adminActions');
  const actions = useAdminActions(filters, size);
  useFetchAllPages(actions, size === 'all');
  const items = actions.data?.pages.flatMap((page) => page.items) ?? [];
  const filtered = Object.keys(filters).length > 0;
  const oneTarget = filters.target_id !== undefined || filters.challenge_id !== undefined;
  // Made once for every row: "all" may list many changes. In the device's
  // zone: a change may touch several challenges, or none.
  const at = useMemo(() => {
    const format = new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      // Said, since it is no challenge's.
      timeZoneName: 'short',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    return (instant: string) => format.format(new Date(instant));
  }, [locale]);

  const choose = (name: string, value: string | undefined) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    setParams(next, { replace: true });
  };
  const clearTarget = () => {
    const next = new URLSearchParams(params);
    next.delete('target_id');
    next.delete('challenge_id');
    setParams(next, { replace: true });
  };

  let body: ReactNode;
  if (actions.isPending) body = <LoadingState />;
  else if (!actions.data) {
    body = <ErrorState error={actions.error} onRetry={() => void actions.refetch()} />;
  } else if (items.length === 0) {
    body = (
      <EmptyState
        message={t(filtered ? 'admin.journal.empty.filtered' : 'admin.journal.empty.none')}
        action={
          filtered && (
            <button
              type="button"
              onClick={() => setParams(new URLSearchParams(), { replace: true })}
              className={BUTTON}
            >
              {t('admin.journal.clearFilters')}
            </button>
          )
        }
      />
    );
  } else {
    body = (
      <>
        <AdminTable
          caption={t('admin.journal.listLabel')}
          columns={[
            t('admin.journal.columns.date'),
            t('admin.journal.columns.admin'),
            t('admin.journal.columns.action'),
            t('admin.journal.columns.target'),
            t('admin.journal.columns.reason'),
          ]}
        >
          {items.map((action) => (
            <ActionRow key={action.id} action={action} at={at} />
          ))}
        </AdminTable>
        <LoadMore
          hasMore={actions.hasNextPage}
          loading={actions.isFetchingNextPage}
          failed={actions.isFetchNextPageError}
          auto={size === 'all'}
          onLoadMore={() => void actions.fetchNextPage()}
        />
      </>
    );
  }

  return (
    // Not a named region: its table is one, under the same name.
    <section className="mt-6 flex flex-col gap-4">
      <Chips
        label={t('admin.journal.targetType.label')}
        options={[undefined, ...ADMIN_ACTION_TARGET_TYPES]}
        selected={filters.target_type}
        onSelect={(value) => choose('target_type', value)}
        name={(value) => t(`admin.journal.targetType.${value ?? 'all'}`)}
      />
      {oneTarget && (
        <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 md:flex-row md:items-center">
          <p className="min-w-0 flex-1">
            {t(
              filters.target_id !== undefined
                ? 'admin.journal.oneTarget.target'
                : 'admin.journal.oneTarget.challenge',
            )}
          </p>
          <button type="button" onClick={clearTarget} className={`${BUTTON} self-start`}>
            {t('admin.journal.oneTarget.clear')}
          </button>
        </div>
      )}
      <PageSizeChoice size={size} onChange={setSize} />
      <div>{body}</div>
    </section>
  );
}

function ActionRow({ action, at }: { action: AdminAction; at: (instant: string) => string }) {
  const { t } = useTranslation();
  const sheet = adminTargetPath(action.target_type, action.target_id);
  const targetJournal = `/admin/journal?${new URLSearchParams({
    target_type: action.target_type,
    target_id: action.target_id,
  }).toString()}`;
  const fields = changedFields(action.old_value, action.new_value);
  const none = <span className="text-muted">{t('admin.journal.values.none')}</span>;
  return (
    <tr>
      <th scope="row" className={`${CELL} font-semibold whitespace-nowrap`}>
        {at(action.created_at)}
      </th>
      <td className={CELL}>{displayName(action.admin) ?? t('admin.challenges.unnamed')}</td>
      <td className={`${CELL} min-w-48`}>
        {/* A change the contract adds before its label: its code. */}
        <span className="font-semibold">
          {t(`admin.actions.${action.action}`, { defaultValue: action.action })}
        </span>
        {fields.length > 0 && (
          <details className="mt-1">
            <summary className="flex min-h-11 cursor-pointer items-center text-accent hover-link">
              {t('admin.journal.values.show')}
            </summary>
            <dl className="mt-2 flex flex-col gap-3">
              {fields.map(({ field, before, after }) => (
                <div key={field}>
                  <dt className="font-mono text-xs text-muted">{field}</dt>
                  <dd className="break-words">
                    {t('admin.journal.values.before')}{' '}
                    {before !== undefined ? journalValue(before) : none}
                  </dd>
                  <dd className="break-words">
                    {t('admin.journal.values.after')}{' '}
                    {after !== undefined ? journalValue(after) : none}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        )}
      </td>
      <td className={CELL}>
        <span className="block">{t(`admin.journal.targetType.${action.target_type}`)}</span>
        {sheet && (
          <Link to={sheet} className={LINK}>
            {t(`admin.journal.target.sheet.${action.target_type}`)}
          </Link>
        )}
        <Link to={targetJournal} className={LINK}>
          {t('admin.journal.target.journal')}
        </Link>
      </td>
      <td className={`${CELL} min-w-48 break-words whitespace-pre-line`}>{action.reason}</td>
    </tr>
  );
}
