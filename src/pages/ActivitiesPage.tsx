import { useTranslation } from 'react-i18next';
import { Page, PageTitle } from '../components/Page';
import { ActivityList } from '../features/activities/ActivityList';
import { AddActivityLink } from '../features/activities/AddActivityLink';

export function ActivitiesPage() {
  const { t } = useTranslation();
  return (
    <Page>
      <PageTitle>{t('activities.title')}</PageTitle>
      {/* Adding an activity always comes first, before the list. */}
      <div className="mt-6">
        <AddActivityLink />
      </div>
      <div className="mt-4">
        <ActivityList />
      </div>
    </Page>
  );
}
