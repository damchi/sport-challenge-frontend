import { useTranslation } from 'react-i18next';
import { useMe } from '../api/hooks/useMe';
import { OnboardingForm } from '../features/profile/OnboardingForm';

export function OnboardingPage() {
  const { t } = useTranslation();
  // The profile gate above has loaded it.
  const { data: me } = useMe();
  return (
    <main className="mx-auto max-w-page px-5 py-8">
      <h1 className="font-display text-title font-bold tracking-title">{t('onboarding.title')}</h1>
      <p className="mt-2 text-muted">{t('onboarding.intro')}</p>
      {me && <OnboardingForm me={me} />}
    </main>
  );
}
