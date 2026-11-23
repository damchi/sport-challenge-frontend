import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Page, PageTitle } from '../components/Page';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <Page>
      <PageTitle>{t('notFound.title')}</PageTitle>
      <Link
        to="/"
        className="mt-6 inline-flex h-11 items-center font-bold text-accent underline underline-offset-4 hover-link"
      >
        {t('notFound.backHome')}
      </Link>
    </Page>
  );
}
