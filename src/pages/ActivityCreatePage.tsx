import { useTranslation } from 'react-i18next';
import { Page } from '../components/Page';
import { ActivityForm } from '../features/activities/ActivityForm';
import { ActivityPageHeader } from '../features/activities/ActivityPageHeader';

export function ActivityCreatePage() {
  const { t } = useTranslation();
  return (
    <Page>
      <ActivityPageHeader title={t('activityForm.title')} />
      <ActivityForm />
    </Page>
  );
}
