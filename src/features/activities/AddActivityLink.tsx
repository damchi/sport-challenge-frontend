import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

/**
 * Tile that opens the activity entry, first of the activities page: the
 * same look as the "Create a challenge" tile of the home page.
 */
export function AddActivityLink() {
  const { t } = useTranslation();
  return (
    <Link
      to="/activities/new"
      className="flex min-h-30 items-center justify-center gap-2 rounded-card border-2 border-dashed border-border-dashed p-4 font-bold text-accent"
    >
      <Plus aria-hidden="true" size={22} strokeWidth={2} />
      {t('activityForm.title')}
    </Link>
  );
}
