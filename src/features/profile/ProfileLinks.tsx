import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

/** Pages reached from the profile, as rows. */
export function ProfileLinks() {
  const { t } = useTranslation();
  return (
    <ul className="mt-6 flex flex-col gap-3">
      <li>
        <Link
          to="/activities"
          className="flex min-h-11 items-center justify-between gap-3 rounded-row border border-border bg-surface px-4 py-3 font-semibold"
        >
          {t('activities.title')}
          <ChevronRight aria-hidden="true" size={20} className="text-muted" />
        </Link>
      </li>
    </ul>
  );
}
