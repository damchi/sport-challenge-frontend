import { useTranslation } from 'react-i18next';
import { Page } from '../components/Page';
import { ActivityEdit } from '../features/activities/ActivityEdit';
import { ActivityPageHeader } from '../features/activities/ActivityPageHeader';

export function ActivityEditPage() {
  const { t } = useTranslation();
  return (
    <Page>
      <ActivityPageHeader title={t('activityEdit.title')} />
      <ActivityEdit />
    </Page>
  );
}
