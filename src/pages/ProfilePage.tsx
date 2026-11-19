import { useTranslation } from 'react-i18next';
import { useMe } from '../api/hooks/useMe';
import { Avatar } from '../components/Avatar';
import { AppSettings } from '../features/settings/AppSettings';
import { Page, PageTitle } from '../components/Page';

export function ProfilePage() {
  const { t } = useTranslation();
  // Loaded by the profile gate above.
  const { data: me } = useMe();
  return (
    <Page>
      <PageTitle>{t('nav.profile')}</PageTitle>
      {me?.pseudo && (
        <p className="mt-4 flex items-center gap-3 font-semibold">
          <Avatar userId={me.id} pseudo={me.pseudo} />
          {me.pseudo}
        </p>
      )}
      <AppSettings />
    </Page>
  );
}
