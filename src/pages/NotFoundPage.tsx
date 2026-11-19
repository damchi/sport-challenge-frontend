import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <main className="mx-auto max-w-page px-5 py-8">
      <h1 className="font-display text-title font-bold tracking-title">{t('notFound.title')}</h1>
      <Link
        to="/"
        className="mt-6 inline-flex h-11 items-center font-bold text-accent underline underline-offset-4"
      >
        {t('notFound.backHome')}
      </Link>
    </main>
  );
}
