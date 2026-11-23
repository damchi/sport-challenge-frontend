import { LogOut } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSignOut } from '../../lib/auth/useSignOut';
import { DeleteAccount } from './DeleteAccount';
import { ACCOUNT_ROW, PROFILE_CARD } from './profileCard';

/** The account card: sign out, then delete the account. */
export function ProfileAccount() {
  const { t } = useTranslation();
  const signOut = useSignOut();
  // Sign-out could not start (network...): it can be tried again.
  const [signOutFailed, setSignOutFailed] = useState(false);
  const trySignOut = () => {
    setSignOutFailed(false);
    signOut().catch(() => setSignOutFailed(true));
  };

  return (
    <section aria-labelledby="account-title" className={PROFILE_CARD}>
      <h2 id="account-title" className="mb-3 font-display text-lg font-bold">
        {t('profile.account.title')}
      </h2>
      <button type="button" onClick={trySignOut} className={ACCOUNT_ROW}>
        <LogOut aria-hidden="true" size={20} />
        {t('settings.signOut')}
      </button>
      {signOutFailed && (
        <p role="alert" className="pb-3 text-sm text-risk-fg">
          {t('errors.unknown')}
        </p>
      )}
      <DeleteAccount />
    </section>
  );
}
