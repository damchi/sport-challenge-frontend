import { useEffect } from 'react';

interface PagedQuery {
  data?: { pages: readonly unknown[] };
  hasNextPage: boolean;
  isFetching: boolean;
  isError: boolean;
  fetchNextPage: () => Promise<unknown>;
}

/**
 * Reads the pages of a list one after the other while `enabled`, until the
 * last one: the list fills page by page. A failed page stops there, the pages
 * already read staying, until `fetchNextPage` is called again (a retry).
 */
export function useFetchAllPages(query: PagedQuery, enabled: boolean) {
  const { hasNextPage, isFetching, isError, fetchNextPage } = query;
  // A quick answer can be rendered at once with its fetch: the count of the
  // pages read is what tells a new page has come.
  const pages = query.data?.pages.length ?? 0;
  useEffect(() => {
    if (enabled && hasNextPage && !isFetching && !isError) void fetchNextPage();
  }, [enabled, hasNextPage, isFetching, isError, fetchNextPage, pages]);
}
