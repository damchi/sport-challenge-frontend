import { useTranslation } from 'react-i18next';
import { Page, PageTitle } from '../components/Page';
import { AddActivityLink } from '../features/activities/AddActivityLink';
import { ChallengeList } from '../features/challenges/ChallengeList';

export function HomePage() {
  const { t } = useTranslation();
  return (
    <Page>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageTitle>{t('challenges.title')}</PageTitle>
        <AddActivityLink />
      </div>
      {/* Room under the list for the floating button of a phone. */}
      <div className="pb-20 md:pb-0">
        <ChallengeList />
      </div>
    </Page>
  );
}
