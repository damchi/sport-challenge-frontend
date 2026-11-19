import { useTranslation } from 'react-i18next';
import { Page, PageTitle } from '../components/Page';

export function ActivitiesPage() {
  const { t } = useTranslation();
  return (
    <Page>
      <PageTitle>{t('activities.title')}</PageTitle>
      <p className="mt-2 text-muted">{t('activities.empty')}</p>
    </Page>
  );
}
