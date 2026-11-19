import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/** The content needs a signed-in user: a sentence and the sign-in action. */
export function SignInRequiredState({ action }: { action: ReactNode }) {
  const { t } = useTranslation();
  return (
    <>
      <p className="mt-2 text-muted">{t('auth.signInRequired')}</p>
      {action}
    </>
  );
}
