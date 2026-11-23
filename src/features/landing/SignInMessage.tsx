import { useTranslation } from 'react-i18next';
import type { LandingSignIn, SignInSource } from './useLandingSignIn';

/** Why the sign-in did not start, where it was asked from. */
export function SignInMessage({
  signIn,
  source,
  className = '',
}: {
  signIn: LandingSignIn;
  source: SignInSource;
  className?: string;
}) {
  const { t } = useTranslation();
  const message = signIn.message(source);
  if (message === 'failed') {
    return (
      <p role="alert" className={`text-sm font-semibold ${className}`}>
        {t('landing.signInError')}
      </p>
    );
  }
  if (message === 'waiting') {
    return (
      <p role="status" className={`text-sm ${className}`}>
        {t('offline.signInLater')}
      </p>
    );
  }
  return null;
}
