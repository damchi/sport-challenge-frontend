import { useTranslation } from 'react-i18next';
import { Page, PageTitle } from '../components/Page';

export function HomePage() {
  const { t } = useTranslation();
  return (
    <Page>
      <PageTitle>{t('home.title')}</PageTitle>
    </Page>
  );
}
