import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { HOME_PATH } from '../../lib/paths';
import { PRIMARY_BUTTON } from './styles';
import type { LandingSignIn, SignInSource } from './useLandingSignIn';

/** « Commencer »: signs in, or goes to the challenges when already signed in. */
export function StartButton({ signIn, source }: { signIn: LandingSignIn; source: SignInSource }) {
  const { t } = useTranslation();
  const content = (
    <>
      {t('landing.start')}
      <ArrowRight aria-hidden="true" size={18} strokeWidth={2} />
    </>
  );
  return signIn.signedIn ? (
    <Link to={HOME_PATH} className={PRIMARY_BUTTON}>
      {content}
    </Link>
  ) : (
    <button
      type="button"
      onClick={() => signIn.signIn(source)}
      disabled={signIn.pending}
      className={PRIMARY_BUTTON}
    >
      {content}
    </button>
  );
}
