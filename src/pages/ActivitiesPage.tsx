import { useTranslation } from 'react-i18next';
import { Page, PageTitle } from '../components/Page';
import { AddActivityLink } from '../features/activities/AddActivityLink';

export function ActivitiesPage() {
  const { t } = useTranslation();
  return (
    <Page>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageTitle>{t('activities.title')}</PageTitle>
        <AddActivityLink />
      </div>
      {/* Room under the content for the floating button of a phone. */}
      <div className="pb-20 md:pb-0">
        <p className="mt-2 text-muted">{t('activities.empty')}</p>
      </div>
    </Page>
  );
}
