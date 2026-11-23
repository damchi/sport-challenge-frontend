import { ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PageTitle } from '../../components/Page';

/**
 * Header of an activity's entry: a phone has the back arrow left of the
 * title; from md, "‹ Mes activités" above it.
 */
export function ActivityPageHeader({ title }: { title: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1 md:flex-col md:items-start md:gap-0">
      <Link
        to="/activities"
        className="-ml-3 inline-flex size-11 flex-none items-center justify-center gap-1 rounded-full font-semibold text-muted md:h-11 md:w-auto md:justify-start md:px-2"
      >
        <ChevronLeft aria-hidden="true" size={22} strokeWidth={2} />
        <span className="sr-only md:not-sr-only">{t('activities.title')}</span>
      </Link>
      <div className="min-w-0 md:mt-2">
        <PageTitle>{title}</PageTitle>
      </div>
    </div>
  );
}
