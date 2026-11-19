import { useTranslation } from 'react-i18next';
import { Page, PageTitle } from '../components/Page';
import { ChallengeCreateWizard } from '../features/challenges/create/ChallengeCreateWizard';

export function ChallengeCreatePage() {
  const { t } = useTranslation();
  return (
    <Page>
      <PageTitle>{t('challengeCreate.title')}</PageTitle>
      <ChallengeCreateWizard />
    </Page>
  );
}
