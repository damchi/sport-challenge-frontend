import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation } from 'react-router';
import { useAuth } from '../lib/auth/auth';
import { useOnline } from '../lib/online';
import { Page } from '../components/Page';

/**
 * Every page below it requires a signed-in user. Signed out, the user goes
 * to the Auth0 sign-in page and comes back to the requested page (without a
 * visible stop when the Auth0 session is still valid). A failed sign-in stays
 * on the page with a retry, instead of looping. Offline, the sign-in waits for
 * the connection: the Auth0 page could not open.
 */
export function RequireAuth() {
  const { t } = useTranslation();
  const auth = useAuth();
  const online = useOnline();
  const { pathname, search, hash } = useLocation();
  const redirecting = useRef(false);
  // The redirect to Auth0 could not start (network...): show a retry.
  const [failed, setFailed] = useState(false);
  const returnTo = `${pathname}${search}${hash}`;

  const mustSignIn =
    online && !auth.isLoading && !auth.isAuthenticated && !auth.hasError && !failed;
  useEffect(() => {
    if (!mustSignIn || redirecting.current) return;
    redirecting.current = true;
    auth.signIn(returnTo).catch(() => {
      redirecting.current = false;
      setFailed(true);
    });
  }, [mustSignIn, auth, returnTo]);

  // One redirect at a time: a double click must not start two sign-ins.
  const [pending, setPending] = useState(false);
  const retry = () => {
    setFailed(false);
    setPending(true);
    // After a refused or failed sign-in, let the user pick the account.
    auth.signIn(returnTo, { chooseAccount: auth.hasError }).catch(() => {
      setFailed(true);
      setPending(false);
    });
  };

  if (auth.isAuthenticated) return <Outlet />;

  return (
    <Page>
      {auth.hasError || failed ? (
        <>
          <p role="alert" className="text-muted">
            {t('auth.callback.error')}
          </p>
          <button
            type="button"
            onClick={retry}
            disabled={pending}
            className="mt-6 h-13 rounded-full bg-accent px-6 text-button font-bold text-on-accent disabled:opacity-60"
          >
            {t('auth.signIn')}
          </button>
        </>
      ) : !online && !auth.isLoading ? (
        // The offline banner above says why.
        <p className="text-muted">{t('offline.signInLater')}</p>
      ) : (
        <p role="status" className="text-muted">
          {t('auth.callback.loading')}
        </p>
      )}
    </Page>
  );
}
