import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router';
import { useAuth } from '../../lib/auth/auth';

/**
 * End of the sign-in redirect. The provider handles the code in the address
 * and then opens the requested page; this shows the wait, or the failure.
 */
export function SignInCallback() {
  const { t } = useTranslation();
  const auth = useAuth();

  if (auth.hasError) {
    return (
      <>
        <p className="mt-2 text-muted">{t('auth.callback.error')}</p>
        <button
          type="button"
          onClick={() => void auth.signIn()}
          className="mt-6 h-13 rounded-full bg-accent px-6 text-button font-bold text-on-accent"
        >
          {t('auth.signIn')}
        </button>
      </>
    );
  }
  // Signed in without a pending redirect (the page opened directly).
  if (!auth.isLoading && auth.isAuthenticated) return <Navigate to="/" replace />;

  return (
    <p role="status" className="mt-2 text-muted">
      {t('auth.callback.loading')}
    </p>
  );
}
