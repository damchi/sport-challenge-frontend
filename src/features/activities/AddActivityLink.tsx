import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

/**
 * The main action of the home page: floating at the bottom right of a
 * phone, above the navigation bar; beside the page title from `md`.
 */
export function AddActivityLink() {
  const { t } = useTranslation();
  return (
    <Link
      to="/activities/new"
      className="fixed right-5 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-10 inline-flex h-13 items-center gap-2 rounded-full bg-accent px-6 text-button font-bold text-on-accent shadow-[0_6px_16px_rgba(22,24,29,.18)] md:static md:h-12 md:shadow-none"
    >
      <Plus aria-hidden="true" size={22} strokeWidth={2} />
      {t('activityForm.title')}
    </Link>
  );
}
