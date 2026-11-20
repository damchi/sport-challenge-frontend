import { ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Page, PageTitle } from '../components/Page';
import { ActivityForm } from '../features/activities/ActivityForm';

export function ActivityCreatePage() {
  const { t } = useTranslation();
  return (
    <Page>
      <Link
        to="/"
        className="-ml-3 inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-full font-semibold text-muted md:justify-start md:px-2"
      >
        <ChevronLeft aria-hidden="true" size={22} strokeWidth={2} />
        <span className="sr-only md:not-sr-only">{t('activityForm.back')}</span>
      </Link>
      <div className="mt-2">
        <PageTitle>{t('activityForm.title')}</PageTitle>
      </div>
      <ActivityForm />
    </Page>
  );
}
