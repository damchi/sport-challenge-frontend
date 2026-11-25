import { useLocation, useMatches } from 'react-router';

/**
 * Data of a route: the translation key of its page title, and whether its
 * children are sections of one page (a challenge's tabs, the admin's parts).
 */
export interface RouteHandle {
  titleKey: string;
  sections?: boolean;
}

export function isRouteHandle(handle: unknown): handle is RouteHandle {
  return (
    typeof handle === 'object' &&
    handle !== null &&
    'titleKey' in handle &&
    typeof handle.titleKey === 'string'
  );
}

/**
 * The page shown, as an address: that of the route whose children are its
 * sections, which stays one page across them, or else the whole address.
 */
export function pageKey(
  matches: readonly { pathname: string; handle: unknown }[],
  pathname: string,
): string {
  const page = matches.find((match) => isRouteHandle(match.handle) && match.handle.sections);
  return page?.pathname ?? pathname;
}

export function usePageKey(): string {
  return pageKey(useMatches(), useLocation().pathname);
}
