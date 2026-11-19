import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { GlobalErrorBanner } from '../components/GlobalErrorBanner';
import { useGlobalError } from '../lib/globalError';

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
