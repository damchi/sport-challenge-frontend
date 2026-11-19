import { useTranslation } from 'react-i18next';
import { useMe } from '../api/hooks/useMe';
import { OnboardingForm } from '../features/profile/OnboardingForm';
import { Page, PageTitle } from '../components/Page';

export function OnboardingPage() {
  const { t } = useTranslation();
  // The profile gate above has loaded it.
  const { data: me } = useMe();
  return (
    <Page>
      <PageTitle>{t('onboarding.title')}</PageTitle>
      <p className="mt-2 text-muted">{t('onboarding.intro')}</p>
      {me && <OnboardingForm me={me} />}
    </Page>
  );
}
