import type { ReactNode } from 'react';
import { LoadMore } from '../../components/LoadMore';
import { PageSizeChoice } from '../../components/PageSizeChoice';
import { EmptyState } from '../../components/states/EmptyState';
import { ErrorState } from '../../components/states/ErrorState';
import { LoadingState } from '../../components/states/LoadingState';
import type { PageSize } from '../../domain/pageSize';
import { SheetPart } from './SheetPart';

interface PagedList {
  isPending: boolean;
  data?: { pages: { items: unknown[] }[] };
  error: Error | null;
  refetch: () => Promise<unknown>;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  fetchNextPage: () => Promise<unknown>;
}

/**
 * A paged part of the sheet: its size choice, then its states, its table and
 * "load more" (or the pages read one after the other for "all").
 */
export function PagedPart({
  title,
  empty,
  list,
  size,
  onSize,
  table,
  action,
  intro,
}: {
  title: string;
  empty: string;
  list: PagedList;
  size: PageSize;
  onSize: (size: PageSize) => void;
  table: ReactNode;
  /** A button beside the title ("Ajouter un participant"). */
  action?: ReactNode;
  /** Shown under the title, before the size choice and the list. */
  intro?: ReactNode;
}) {
  let body: ReactNode;
  if (list.isPending) body = <LoadingState />;
  else if (!list.data) {
    body = <ErrorState error={list.error} onRetry={() => void list.refetch()} />;
  } else if (list.data.pages.every((page) => page.items.length === 0)) {
    body = <EmptyState message={empty} />;
  } else {
    body = (
      <>
        {table}
        <LoadMore
          hasMore={list.hasNextPage}
          loading={list.isFetchingNextPage}
          failed={list.isFetchNextPageError}
          auto={size === 'all'}
          onLoadMore={() => void list.fetchNextPage()}
        />
      </>
    );
  }
  return (
    <SheetPart title={title} action={action}>
      {intro}
      <PageSizeChoice size={size} onChange={onSize} legend={title} />
      <div>{body}</div>
    </SheetPart>
  );
}
