import { useTranslation } from 'react-i18next';

interface LoadMoreProps {
  hasMore: boolean;
  loading: boolean;
  /** The last "load more" failed: the loaded items stay, with a retry. */
  failed?: boolean;
  /** Every page is read one after the other ("all"): no button but a retry. */
  auto?: boolean;
  onLoadMore: () => void;
}

/**
 * End of a paginated list: "Load more" while the server has a next page, or,
 * while every page is read on its own, a loading line.
 */
export function LoadMore({
  hasMore,
  loading,
  failed = false,
  auto = false,
  onLoadMore,
}: LoadMoreProps) {
  const { t } = useTranslation();
  // While every page is read, the live region stays in place (a region
  // inserted with its text is not always read): only its text changes.
  const reading = (
    <p role="status" className="mt-4 text-center text-sm text-muted empty:hidden">
      {auto && hasMore && !failed ? t('states.loading') : ''}
    </p>
  );
  if (auto && (!hasMore || !failed)) return reading;
  if (!hasMore) return null;
  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      {failed && (
        <p role="alert" className="text-sm text-risk-fg">
          {t('states.loadMoreFailed')}
        </p>
      )}
      <button
        type="button"
        onClick={onLoadMore}
        disabled={loading}
        aria-busy={loading}
        className="flex h-11 items-center rounded-full border border-border bg-surface hover-fill px-6 font-bold disabled:opacity-60"
      >
        {loading ? t('states.loading') : failed ? t('errorPage.retry') : t('states.loadMore')}
      </button>
    </div>
  );
}
