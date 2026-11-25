import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useMatches } from 'react-router';
import { DocumentTitle } from '../components/DocumentTitle';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { GlobalErrorBanner } from '../components/GlobalErrorBanner';
import { OfflineBanner } from '../components/OfflineBanner';
import { useGlobalError } from '../lib/globalError';
import { isRouteHandle, usePageKey } from './routeHandle';

/**
 * Wraps every page: the offline and global error banners above it, and an
 * error boundary around it. A navigation leaves both the error banner and
 * the error page behind, without remounting the app below.
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
  const appName = t('home.title');
  const title = titleKey ? `${t(titleKey)} · ${appName}` : appName;

  // After a navigation to another page (not the first page), focus moves to
  // its title, so a screen reader starts reading there. Between the sections
  // of a page, it stays where it was (the tab chosen), unless the element
  // focused is gone (the link followed, in a list replaced by a detail).
  // Comparing the path (not a flag) keeps StrictMode's second run from moving
  // it on the first page. A page shows its h1 while it loads, or the focus
  // stays where it was.
  const page = usePageKey();
  const previous = useRef({ pathname, page });
  // The last element focused: the focus is lost when it is gone. A clicked
  // link takes no focus in Safari, which must not count as lost.
  const lastFocused = useRef<Element | null>(null);
  useEffect(() => {
    const remember = (event: FocusEvent) => {
      if (event.target instanceof Element) lastFocused.current = event.target;
    };
    document.addEventListener('focusin', remember);
    return () => document.removeEventListener('focusin', remember);
  }, []);
  useEffect(() => {
    if (previous.current.pathname === pathname) return;
    const samePage = previous.current.page === page;
    previous.current = { pathname, page };
    const focusLost =
      document.activeElement === document.body && lastFocused.current?.isConnected === false;
    // Only what is focused from now on counts for the next navigation.
    lastFocused.current = null;
    if (samePage && !focusLost) return;
    const heading = document.querySelector('main h1');
    if (heading instanceof HTMLElement) {
      heading.tabIndex = -1;
      heading.focus();
    }
  }, [pathname, page]);

  return (
    <>
      {/* Before the outlet: a page's own title wins. */}
      <DocumentTitle title={title} />
      <OfflineBanner />
      {error !== undefined && (
        <div className="px-5 lg:px-8">
          <GlobalErrorBanner error={error} onDismiss={dismiss} />
        </div>
      )}
      <ErrorBoundary resetKey={pathname}>
        <Outlet />
      </ErrorBoundary>
    </>
  );
}
