import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Page, PageTitle } from '../components/Page';
import { ActivityList } from '../features/activities/ActivityList';

export function ActivitiesPage() {
  const { t } = useTranslation();
  return (
    <Page>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageTitle>{t('activities.title')}</PageTitle>
        {/* "Add" on a phone, in full from `lg`; the full words for a screen reader. */}
        <Link
          to="/activities/new"
          aria-label={t('activityForm.title')}
          className="inline-flex min-h-12 items-center gap-2 rounded-full bg-accent hover-accent px-5 py-2 text-button font-bold text-on-accent lg:px-6"
        >
          <Plus aria-hidden="true" size={20} strokeWidth={2.5} className="flex-none" />
          <span className="lg:hidden">{t('activities.add')}</span>
          <span className="hidden lg:inline">{t('activityForm.title')}</span>
        </Link>
      </div>
      <div className="mt-6">
        <ActivityList />
      </div>
    </Page>
  );
}
