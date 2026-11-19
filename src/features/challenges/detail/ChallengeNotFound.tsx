import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PageTitle } from '../../../components/Page';

/**
 * No challenge to show. The same words whether it never existed, was deleted
 * or is private: the page never tells which.
 */
export function ChallengeNotFound() {
  const { t } = useTranslation();
  return (
    <>
      <PageTitle>{t('challengeDetail.notFound.title')}</PageTitle>
      <p className="mt-2 text-muted">{t('challengeDetail.notFound.message')}</p>
      <Link
        to="/"
        className="mt-6 inline-flex h-11 items-center font-bold text-accent underline underline-offset-4"
      >
        {t('notFound.backHome')}
      </Link>
    </>
  );
}
