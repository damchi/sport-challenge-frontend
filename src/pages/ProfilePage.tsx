import { useTranslation } from 'react-i18next';
import { useMe } from '../api/hooks/useMe';
import { Page, PageTitle } from '../components/Page';
import { DeleteAccount } from '../features/profile/DeleteAccount';
import { ProfileHeader } from '../features/profile/ProfileHeader';
import { ProfileIdentity } from '../features/profile/ProfileIdentity';
import { ProfileLinks } from '../features/profile/ProfileLinks';
import { PseudoForm } from '../features/profile/PseudoForm';
import { AppSettings } from '../features/settings/AppSettings';

/** Profile tab: who the user is, the pages reached from it, the settings, then the account deletion. */
export function ProfilePage() {
  const { t } = useTranslation();
  // The profile gate above has loaded it.
  const { data: me } = useMe();
  return (
    <Page>
      <PageTitle>{t('nav.profile')}</PageTitle>
      {me && (
        <>
          <ProfileHeader me={me} />
          <ProfileIdentity me={me} />
          <PseudoForm me={me} />
        </>
      )}
      <ProfileLinks />
      <AppSettings />
      <DeleteAccount />
    </Page>
  );
}
