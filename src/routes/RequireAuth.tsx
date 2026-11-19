import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation } from 'react-router';
import { useAuth } from '../lib/auth/auth';

/**
 * Every page below it requires a signed-in user. Signed out, the user goes
 * to the Auth0 sign-in page and comes back to the requested page (without a
 * visible stop when the Auth0 session is still valid). A failed sign-in stays
 * on the page with a retry, instead of looping.
 */
export function RequireAuth() {
  const { t } = useTranslation();
  const auth = useAuth();
  const { pathname, search, hash } = useLocation();
  const redirecting = useRef(false);

  const mustSignIn = !auth.isLoading && !auth.isAuthenticated && !auth.hasError;
  useEffect(() => {
    if (!mustSignIn || redirecting.current) return;
    redirecting.current = true;
    auth.signIn(`${pathname}${search}${hash}`).catch(() => {
      redirecting.current = false;
    });
  }, [mustSignIn, auth, pathname, search, hash]);

  if (auth.isAuthenticated) return <Outlet />;

  return (
    <main className="mx-auto max-w-page px-5 py-8">
      {auth.hasError ? (
        <>
          <p role="alert" className="text-muted">
            {t('auth.callback.error')}
          </p>
          <button
            type="button"
            onClick={() => auth.signIn(`${pathname}${search}${hash}`).catch(() => undefined)}
            className="mt-6 h-13 rounded-full bg-accent px-6 text-button font-bold text-on-accent"
          >
            {t('auth.signIn')}
          </button>
        </>
      ) : (
        <p role="status" className="text-muted">
          {t('auth.callback.loading')}
        </p>
      )}
    </main>
  );
}
