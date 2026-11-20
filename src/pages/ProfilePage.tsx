import { useTranslation } from 'react-i18next';
import { useMe } from '../api/hooks/useMe';
import { Page, PageTitle } from '../components/Page';
import { ProfileIdentity } from '../features/profile/ProfileIdentity';
import { PseudoForm } from '../features/profile/PseudoForm';
import { AppSettings } from '../features/settings/AppSettings';

/** Profile tab: who the user is, then the settings. */
export function ProfilePage() {
  const { t } = useTranslation();
  // The profile gate above has loaded it.
  const { data: me } = useMe();
  return (
    <Page>
      <PageTitle>{t('nav.profile')}</PageTitle>
      {me && (
        <>
          <ProfileIdentity me={me} />
          <PseudoForm me={me} />
        </>
      )}
      <AppSettings />
    </Page>
  );
}
