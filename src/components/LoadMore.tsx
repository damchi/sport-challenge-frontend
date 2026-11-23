import { useTranslation } from 'react-i18next';

interface LoadMoreProps {
  hasMore: boolean;
  loading: boolean;
  /** The last "load more" failed: the loaded items stay, with a retry. */
  failed?: boolean;
  onLoadMore: () => void;
}

/** End of a paginated list: "Load more" while the server has a next page. */
export function LoadMore({ hasMore, loading, failed = false, onLoadMore }: LoadMoreProps) {
  const { t } = useTranslation();
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
