import { ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Page, PageTitle } from '../components/Page';
import { ActivityEdit } from '../features/activities/ActivityEdit';

export function ActivityEditPage() {
  const { t } = useTranslation();
  return (
    <Page>
      <Link
        to="/activities"
        className="-ml-3 inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-full font-semibold text-muted md:justify-start md:px-2"
      >
        <ChevronLeft aria-hidden="true" size={22} strokeWidth={2} />
        <span className="sr-only md:not-sr-only">{t('activities.title')}</span>
      </Link>
      <div className="mt-2">
        <PageTitle>{t('activityEdit.title')}</PageTitle>
      </div>
      <ActivityEdit />
    </Page>
  );
}
