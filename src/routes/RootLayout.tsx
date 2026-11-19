import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useMatches } from 'react-router';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { GlobalErrorBanner } from '../components/GlobalErrorBanner';
import { useGlobalError } from '../lib/globalError';
import { isRouteHandle } from './routeHandle';

/**
 * Wraps every page: the global error banner above it, and an error boundary
 * around it. A navigation leaves both the banner and the error page behind.
 */
export function RootLayout() {
  const { pathname } = useLocation();
  const { error, dismiss } = useGlobalError();

  useEffect(() => {
    dismiss();
  }, [pathname, dismiss]);

  // Page title from the deepest route that names one.
  const { t } = useTranslation();
  const titleKey = useMatches()
    .map((match) => match.handle)
    .filter(isRouteHandle)
    .at(-1)?.titleKey;
  useEffect(() => {
    const appName = t('home.title');
    document.title = titleKey ? `${t(titleKey)} · ${appName}` : appName;
  }, [titleKey, t]);

  // After a navigation (not the first page), focus moves to the new page's
  // title, so a screen reader starts reading there. Comparing the path (not a
  // flag) keeps StrictMode's second run from moving it on the first page.
  // A page shows its h1 while it loads, or the focus stays where it was.
  const previousPath = useRef(pathname);
  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    const heading = document.querySelector('main h1');
    if (heading instanceof HTMLElement) {
      heading.tabIndex = -1;
      heading.focus();
    }
  }, [pathname]);

  return (
    <>
      {error !== undefined && (
        <div className="px-5">
          <GlobalErrorBanner error={error} onDismiss={dismiss} />
        </div>
      )}
      <ErrorBoundary key={pathname}>
        <Outlet />
      </ErrorBoundary>
    </>
  );
}
