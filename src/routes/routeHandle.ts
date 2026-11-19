/** Data of a route: the translation key of its page title. */
export interface RouteHandle {
  titleKey: string;
}

export function isRouteHandle(handle: unknown): handle is RouteHandle {
  return (
    typeof handle === 'object' &&
    handle !== null &&
    'titleKey' in handle &&
    typeof handle.titleKey === 'string'
  );
}
