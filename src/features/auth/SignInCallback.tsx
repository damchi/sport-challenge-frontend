import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router';
import { useAuth } from '../../lib/auth/auth';

function SignInButton() {
  const { t } = useTranslation();
  const auth = useAuth();
  return (
    <button
      type="button"
      onClick={() => void auth.signIn()}
      className="mt-6 h-13 rounded-full bg-accent px-6 text-button font-bold text-on-accent"
    >
      {t('auth.signIn')}
    </button>
  );
}

/**
 * End of the sign-in redirect. The provider handles the code in the address
 * and then opens the requested page; this shows the wait, or what went wrong.
 */
export function SignInCallback() {
  const { t } = useTranslation();
  const auth = useAuth();

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
  if (auth.isLoading) {
    return (
      <p role="status" className="mt-2 text-muted">
        {t('auth.callback.loading')}
      </p>
    );
  }
  // Signed in without a pending redirect (the page opened directly).
  if (auth.isAuthenticated) return <Navigate to="/" replace />;
  // Opened directly while signed out: nothing to finish.
  return (
    <>
      <p className="mt-2 text-muted">{t('auth.signInRequired')}</p>
      <SignInButton />
    </>
  );
}
