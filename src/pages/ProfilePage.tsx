import { useTranslation } from 'react-i18next';
import { useMe } from '../api/hooks/useMe';
import { Page, PageTitle } from '../components/Page';
import { ProfileAccount } from '../features/profile/ProfileAccount';
import { ProfileHeader } from '../features/profile/ProfileHeader';
import { ProfileIdentity } from '../features/profile/ProfileIdentity';
import { ProfilePreferences } from '../features/profile/ProfilePreferences';

/**
 * Profile tab: who the user is and the way to their activities (left column
 * on the web), then identity, preferences and account cards.
 */
export function ProfilePage() {
  const { t } = useTranslation();
  // The profile gate above has loaded it.
  const { data: me } = useMe();
  return (
    <Page>
      <PageTitle>{t('nav.profile')}</PageTitle>
      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-8">
        {me && <ProfileHeader me={me} />}
        <div className="flex min-w-0 flex-col gap-5 lg:gap-8">
          {me && <ProfileIdentity me={me} />}
          <ProfilePreferences />
          <ProfileAccount />
        </div>
      </div>
    </Page>
  );
}
