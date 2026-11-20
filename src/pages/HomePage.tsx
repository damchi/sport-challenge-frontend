import { useTranslation } from 'react-i18next';
import { Page, PageTitle } from '../components/Page';
import { ChallengeList } from '../features/challenges/ChallengeList';

export function HomePage() {
  const { t } = useTranslation();
  return (
    <Page>
      <PageTitle>{t('challenges.title')}</PageTitle>
      <ChallengeList />
    </Page>
  );
}
