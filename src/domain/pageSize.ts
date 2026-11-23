// How many items a list shows at a time: 10 or 50 with "load more", or all
// of them, read page after page.

export const PAGE_SIZES = ['10', '50', 'all'] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

export const DEFAULT_PAGE_SIZE: PageSize = '10';

export function isPageSize(value: unknown): value is PageSize {
  return typeof value === 'string' && (PAGE_SIZES as readonly string[]).includes(value);
}

/** The largest `limit` the API serves (its `maximum` in openapi.yaml). */
export const MAX_PAGE_LIMIT = 100;

/** The `limit` of each request: "all" reads the largest pages the API serves. */
export function pageLimit(size: PageSize): number {
  return size === 'all' ? MAX_PAGE_LIMIT : Number(size);
}
