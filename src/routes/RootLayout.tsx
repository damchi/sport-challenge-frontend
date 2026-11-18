import { Outlet, useLocation } from 'react-router';
import { ErrorBoundary } from '../components/ErrorBoundary';

/** Wraps every page: a navigation leaves the error page of the previous one. */
export function RootLayout() {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary key={pathname}>
      <Outlet />
    </ErrorBoundary>
  );
}
