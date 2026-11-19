import { useTranslation } from 'react-i18next';

export function ActivitiesPage() {
  const { t } = useTranslation();
  return (
    <main className="mx-auto max-w-page px-5 py-8">
      <h1 className="font-display text-title font-bold tracking-title">{t('activities.title')}</h1>
      <p className="mt-2 text-muted">{t('activities.empty')}</p>
    </main>
  );
}
