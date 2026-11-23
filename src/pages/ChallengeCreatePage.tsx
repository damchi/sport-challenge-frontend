import { ChevronLeft, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Page, PageTitle } from '../components/Page';
import { ChallengeCreateWizard } from '../features/challenges/create/ChallengeCreateWizard';

export function ChallengeCreatePage() {
  const { t } = useTranslation();
  return (
    <Page>
      {/* Phone: a close cross left of the title; from md: "‹ Défis" above it. */}
      <div className="flex items-center gap-2 md:flex-col md:items-start md:gap-0">
        <Link
          to="/"
          aria-label={t('challengeCreate.close')}
          className="-ml-3 inline-flex size-11 flex-none items-center justify-center rounded-full hover-fill md:hidden"
        >
          <X aria-hidden="true" size={24} strokeWidth={2} />
        </Link>
        <Link
          to="/"
          className="-ml-2 hidden h-11 items-center gap-1 px-2 font-semibold text-muted md:inline-flex"
        >
          <ChevronLeft aria-hidden="true" size={22} strokeWidth={2} />
          {t('challengeCreate.back')}
        </Link>
        <div className="min-w-0 md:mt-2">
          <PageTitle>{t('challengeCreate.title')}</PageTitle>
        </div>
      </div>
      <ChallengeCreateWizard />
    </Page>
  );
}
