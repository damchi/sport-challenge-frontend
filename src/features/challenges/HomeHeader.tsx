import { useTranslation } from 'react-i18next';
import { useMe } from '../../api/hooks/useMe';
import { PageTitle } from '../../components/Page';
import { CreateChallengeFab, CreateChallengeLink } from './CreateChallengeLink';

/**
 * Head of the home page: a greeting with the user's first name (else their
 * pseudo, else none), the title, and « Créer un défi »: beside the title
 * from `md`, a floating button on a phone.
 */
export function HomeHeader() {
  const { t } = useTranslation();
  const me = useMe();
  const name = me.data?.first_name ?? me.data?.pseudo;
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        {/* Its line is kept while the profile loads: the title does not move. */}
        <p className="min-h-6 text-muted">{name && t('challenges.greeting', { name })}</p>
        <PageTitle>{t('challenges.title')}</PageTitle>
      </div>
      <CreateChallengeLink display="hidden md:inline-flex" />
      <CreateChallengeFab />
    </div>
  );
}
