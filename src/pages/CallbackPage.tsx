import { useTranslation } from 'react-i18next';
import { SignInCallback } from '../features/auth/SignInCallback';

export function CallbackPage() {
  const { t } = useTranslation();
  return (
    <main className="mx-auto max-w-page px-5 py-8">
      <h1 className="font-display text-title font-bold tracking-title">
        {t('auth.callback.title')}
      </h1>
      <SignInCallback />
    </main>
  );
}
