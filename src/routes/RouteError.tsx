import { useEffect } from 'react';
import { useRouteError } from 'react-router';
import { ErrorPage } from '../components/ErrorPage';
import { reportError } from '../lib/errorTracking';

/**
 * An error of the router itself, such as a page whose code failed to load
 * (no network, or a new release that replaced its file). Reloading fetches
 * the current release. Inside the shell, the main navigation stays above it.
 */
export function RouteError() {
  const error = useRouteError();
  useEffect(() => {
    reportError(error);
  }, [error]);
  return <ErrorPage onRetry={() => window.location.reload()} />;
}
