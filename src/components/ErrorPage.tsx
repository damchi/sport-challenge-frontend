import { useTranslation } from 'react-i18next';

export function ErrorPage({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <main className="mx-auto max-w-page px-5 py-8">
      <h1 className="font-display text-title font-bold tracking-title">{t('errorPage.title')}</h1>
      <p className="mt-2 text-muted">{t('errors.unknown')}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 h-13 rounded-full bg-accent px-6 text-button font-bold text-on-accent"
      >
        {t('errorPage.retry')}
      </button>
    </main>
  );
}
