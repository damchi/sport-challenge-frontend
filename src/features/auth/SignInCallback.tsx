import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useSearchParams } from 'react-router';
import { useAuth } from '../../lib/auth/auth';

function SignInButton() {
  const { t } = useTranslation();
  const auth = useAuth();
  const [failed, setFailed] = useState(false);

  const signIn = () => {
    setFailed(false);
    // After a refused or failed sign-in, let the user pick the account.
    auth.signIn(undefined, { chooseAccount: auth.hasError }).catch((error: unknown) => {
      // The redirect to Auth0 could not start (configuration, insecure
      // origin...): the detail is for the developer only.
      if (import.meta.env.DEV) console.error('Sign-in could not start', error);
      setFailed(true);
    });
  };

  return (
    <>
      {failed && (
        <p role="alert" className="mt-2 text-muted">
          {t('auth.callback.error')}
        </p>
      )}
      <button
        type="button"
        onClick={signIn}
        className="mt-6 h-13 rounded-full bg-accent px-6 text-button font-bold text-on-accent"
      >
        {t('auth.signIn')}
      </button>
    </>
  );
}

/**
 * End of the sign-in redirect. The provider handles the code in the address
 * and then opens the requested page; this shows the wait, or what went wrong.
 */
export function SignInCallback() {
  const { t } = useTranslation();
  const auth = useAuth();
  const [params] = useSearchParams();
  // Back from Auth0: the provider opens the requested page itself.
  const returningFromSignIn = params.has('code') && params.has('state');

  if (auth.hasError) {
    return (
      <>
        <p role="alert" className="mt-2 text-muted">
          {t('auth.callback.error')}
        </p>
        <SignInButton />
      </>
    );
  }
  if (auth.isLoading || (auth.isAuthenticated && returningFromSignIn)) {
    return (
      <p role="status" className="mt-2 text-muted">
        {t('auth.callback.loading')}
      </p>
    );
  }
  // Signed in, page opened directly: nothing to finish.
  if (auth.isAuthenticated) return <Navigate to="/" replace />;
  // Opened directly while signed out: nothing to finish.
  return (
    <>
      <p className="mt-2 text-muted">{t('auth.signInRequired')}</p>
      <SignInButton />
    </>
  );
}
