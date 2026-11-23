import { useTranslation } from 'react-i18next';
import { Page, PageTitle } from './Page';

export function ErrorPage({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <Page>
      <PageTitle>{t('errorPage.title')}</PageTitle>
      <p className="mt-2 text-muted">{t('errors.unknown')}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 h-13 rounded-full bg-accent hover-accent px-6 text-button font-bold text-on-accent"
      >
        {t('errorPage.retry')}
      </button>
    </Page>
  );
}
